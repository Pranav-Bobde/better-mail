import { auth } from "@code-main/auth";
import { mailSyncEventSchema, type MailSyncEvent } from "@code-main/api/mail/sync/contracts";
import { createGmailSyncProvider } from "@code-main/api/mail/sync/gmail-sync-provider";
import {
  createMailSyncWorkerFields,
  type MailSyncWideEventFields,
} from "@code-main/api/mail/sync/observability";
import { createPrismaMailSyncRepository } from "@code-main/api/mail/sync/prisma-mail-sync-repository";
import { MailSyncLockBusyError, SYNC_LEASE_SECONDS } from "@code-main/api/mail/sync/processor";
import { runMailSyncEvent } from "@code-main/api/runtime";
import { handleCallback } from "@vercel/queue";

import { log, withEvlog } from "@/shared/lib/evlog";
import { vercelMailSyncBroker } from "@/shared/lib/mail-sync-queue";
import { ablyMailRealtimeNotifier } from "@/shared/lib/mail-realtime-runtime";

const maxDeliveryCount = 10;
const lockBusyRetrySeconds = 30;

const handleMailSyncQueueCallback = handleCallback(
  async (rawEvent, metadata) => {
    const event = mailSyncEventSchema.parse(rawEvent);

    if (metadata.deliveryCount > maxDeliveryCount) {
      await markMailAccountNeedsResyncForDroppedEvent(event);
      logMailSyncWorkerFields(
        createMailSyncWorkerFields({
          errorName: "MaxDeliveryCountExceeded",
          metadata,
          outcome: "dropped",
        }),
      );

      return;
    }

    try {
      // The processor is an Effect service: runMailSyncEvent runs it through the
      // singleton runtime (which supplies the MailSyncRepository dependency) and
      // re-throws the raw error, so the retry branch below still sees a real
      // MailSyncLockBusyError.
      const result = await runMailSyncEvent(event, {
        gmailProvider: createGmailSyncProvider(),
        lockOwnerId: metadata.messageId,
        log,
        now: new Date(),
        realtimeNotifier: ablyMailRealtimeNotifier,
        tokenProvider: {
          getGoogleAccessToken: async (input) => {
            const token = await auth.api.getAccessToken({
              body: {
                accountId: input.providerAccountId,
                providerId: "google",
                userId: input.userId,
              },
            });

            return {
              accessToken: token.accessToken,
              scopes: token.scopes,
            };
          },
        },
      });

      if (result?.continuationEvent) {
        await vercelMailSyncBroker.enqueueMailSyncEvent(result.continuationEvent);
      }
    } catch (error) {
      logMailSyncWorkerFields(
        createMailSyncWorkerFields({
          errorCode: getErrorCode(error),
          errorName: getErrorName(error),
          event,
          metadata,
          outcome: "failed",
        }),
      );

      throw error;
    }

    logMailSyncWorkerFields(
      createMailSyncWorkerFields({
        event,
        metadata,
        outcome: "processed",
      }),
    );
  },
  {
    retry: (error, metadata) => {
      if (metadata.deliveryCount > maxDeliveryCount) {
        logMailSyncWorkerFields(
          createMailSyncWorkerFields({
            errorCode: getErrorCode(error),
            errorName: getErrorName(error),
            metadata,
            outcome: "dropped",
          }),
        );

        return { acknowledge: true };
      }

      if (error instanceof MailSyncLockBusyError) {
        logMailSyncWorkerFields(
          createMailSyncWorkerFields({
            errorCode: getErrorCode(error),
            errorName: error.name,
            metadata,
            outcome: "retry",
            retryAfterSeconds: lockBusyRetrySeconds,
          }),
        );

        return { afterSeconds: lockBusyRetrySeconds };
      }

      const retryAfterSeconds = Math.min(300, 2 ** metadata.deliveryCount * 5);
      logMailSyncWorkerFields(
        createMailSyncWorkerFields({
          errorCode: getErrorCode(error),
          errorName: getErrorName(error),
          metadata,
          outcome: "retry",
          retryAfterSeconds,
        }),
      );

      return { afterSeconds: retryAfterSeconds };
    },
    visibilityTimeoutSeconds: SYNC_LEASE_SECONDS,
  },
);

async function markMailAccountNeedsResyncForDroppedEvent(event: MailSyncEvent) {
  try {
    // RESYNC_NEEDED misses the ACTIVE-only cache, so the next default mailbox load
    // bootstraps live Gmail data and resets the account back to ACTIVE.
    await createPrismaMailSyncRepository().markMailAccountNeedsResync(event.mailAccountId);
  } catch (error) {
    log.info({
      errorCode: getErrorCode(error),
      errorName: getErrorName(error),
      mailSync: {
        eventType: event.type,
        mailAccountId: event.mailAccountId,
      },
      module: "mail",
      operation: "mail.sync.queue.drop.resync_mark",
      outcome: "failed",
    });
  }
}

function logMailSyncWorkerFields(fields: MailSyncWideEventFields) {
  log.info({ ...fields });
}

function getErrorName(error: unknown) {
  if (error instanceof Error) {
    return error.name;
  }

  return "UnknownError";
}

function getErrorCode(error: unknown) {
  const code = (Object(error) as { readonly code?: unknown }).code;

  return typeof code === "string" ? code : undefined;
}

export const POST = withEvlog(handleMailSyncQueueCallback);
