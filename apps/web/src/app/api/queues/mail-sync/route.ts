import { auth } from "@code-main/auth";
import { mailSyncEventSchema } from "@code-main/api/mail/sync/contracts";
import { createGmailSyncProvider } from "@code-main/api/mail/sync/gmail-sync-provider";
import {
  createMailSyncWorkerFields,
  type MailSyncWideEventFields,
} from "@code-main/api/mail/sync/observability";
import { createPrismaMailSyncRepository } from "@code-main/api/mail/sync/prisma-mail-sync-repository";
import { MailSyncLockBusyError, processMailSyncEvent } from "@code-main/api/mail/sync/processor";
import { handleCallback } from "@vercel/queue";

import { log, withEvlog } from "@/shared/lib/evlog";

const maxDeliveryCount = 10;
const lockBusyRetrySeconds = 30;

const handleMailSyncQueueCallback = handleCallback(
  async (rawEvent, metadata) => {
    const event = mailSyncEventSchema.parse(rawEvent);

    await processMailSyncEvent(event, {
      gmailProvider: createGmailSyncProvider(),
      lockOwnerId: metadata.messageId,
      now: new Date(),
      repository: createPrismaMailSyncRepository(),
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
          errorName: getErrorName(error),
          metadata,
          outcome: "retry",
          retryAfterSeconds,
        }),
      );

      return { afterSeconds: retryAfterSeconds };
    },
    visibilityTimeoutSeconds: 300,
  },
);

function logMailSyncWorkerFields(fields: MailSyncWideEventFields) {
  log.info({ ...fields });
}

function getErrorName(error: unknown) {
  if (error instanceof Error) {
    return error.name;
  }

  return "UnknownError";
}

export const POST = withEvlog(handleMailSyncQueueCallback);
