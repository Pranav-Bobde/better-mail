import { findGmailMailAccountsDueForWatchRenewal } from "@code-main/api/runtime";

import { vercelMailSyncBroker } from "@/shared/lib/mail-sync-queue";

const activeMailboxWindowMs = 24 * 60 * 60 * 1000;
const watchRenewalBufferMs = 48 * 60 * 60 * 1000;

export async function GET() {
  const now = Date.now();
  const mailAccounts = await findGmailMailAccountsDueForWatchRenewal({
    activeSince: new Date(now - activeMailboxWindowMs),
    expiresBefore: new Date(now + watchRenewalBufferMs),
  });

  await Promise.all(
    mailAccounts.map((mailAccount) =>
      vercelMailSyncBroker.enqueueMailSyncEvent({
        mailAccountId: mailAccount.id,
        type: "GMAIL_RENEW_WATCH_REQUESTED",
      }),
    ),
  );

  return Response.json({
    status: "ok",
    data: {
      enqueued: mailAccounts.length,
    },
  });
}
