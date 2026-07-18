import assert from "node:assert/strict";
import { mock, test } from "node:test";

import { DuplicateMessageError, type send } from "@vercel/queue";

import { mailSyncQueueTopic } from "@code-main/api/mail/sync/broker";
import type { MailSyncEvent } from "@code-main/api/mail/sync/contracts";

import { log } from "@/shared/lib/evlog";
import {
  getMailSyncEventIdempotencyKey,
  mockMailSyncQueueSendForTest,
  vercelMailSyncBroker,
} from "@/shared/lib/mail-sync-queue";

test("manual incremental sync keys use minute buckets", () => {
  const event: MailSyncEvent = {
    mailAccountId: "mail-account-id",
    type: "GMAIL_INCREMENTAL_SYNC_REQUESTED",
  };

  assert.equal(
    getMailSyncEventIdempotencyKey(event, new Date("2026-07-19T10:30:10.000Z")),
    getMailSyncEventIdempotencyKey(event, new Date("2026-07-19T10:30:59.999Z")),
  );
  assert.notEqual(
    getMailSyncEventIdempotencyKey(event, new Date("2026-07-19T10:30:59.999Z")),
    getMailSyncEventIdempotencyKey(event, new Date("2026-07-19T10:31:00.000Z")),
  );
});

test("incremental sync keys with notification history id keep the existing format", () => {
  const event: MailSyncEvent = {
    mailAccountId: "mail-account-id",
    notificationHistoryId: "9876543210",
    type: "GMAIL_INCREMENTAL_SYNC_REQUESTED",
  };

  assert.equal(
    getMailSyncEventIdempotencyKey(event, new Date("2026-07-19T10:30:10.000Z")),
    "GMAIL_INCREMENTAL_SYNC_REQUESTED:mail-account-id:9876543210",
  );
  assert.equal(
    getMailSyncEventIdempotencyKey(event, new Date("2026-07-19T10:30:10.000Z")),
    getMailSyncEventIdempotencyKey(event, new Date("2026-07-20T10:30:10.000Z")),
  );
});

test("non-incremental sync keys do not include time", () => {
  const bootstrapEvent: MailSyncEvent = {
    mailAccountId: "mail-account-id",
    type: "GMAIL_BOOTSTRAP_SYNC_REQUESTED",
  };
  const renewEvent: MailSyncEvent = {
    mailAccountId: "mail-account-id",
    type: "GMAIL_RENEW_WATCH_REQUESTED",
  };

  assert.equal(
    getMailSyncEventIdempotencyKey(bootstrapEvent, new Date("2026-07-19T10:30:10.000Z")),
    "GMAIL_BOOTSTRAP_SYNC_REQUESTED:mail-account-id",
  );
  assert.equal(
    getMailSyncEventIdempotencyKey(renewEvent, new Date("2026-07-19T10:31:10.000Z")),
    "GMAIL_RENEW_WATCH_REQUESTED:mail-account-id",
  );
});

test("duplicate queue send returns a null message id and logs the duplicate", async () => {
  const event: MailSyncEvent = {
    mailAccountId: "mail-account-id",
    notificationHistoryId: "9876543210",
    type: "GMAIL_INCREMENTAL_SYNC_REQUESTED",
  };
  const sendMock = mock.fn(async () => {
    throw new DuplicateMessageError(
      "Duplicate idempotency key",
      "GMAIL_INCREMENTAL_SYNC_REQUESTED:mail-account-id:9876543210",
    );
  });
  const restoreSend = mockMailSyncQueueSendForTest(sendMock as typeof send);
  const logMock = mock.method(log, "info", () => undefined);

  try {
    const result = await vercelMailSyncBroker.enqueueMailSyncEvent(event);

    assert.deepEqual(result, {
      idempotencyKey: "GMAIL_INCREMENTAL_SYNC_REQUESTED:mail-account-id:9876543210",
      messageId: null,
      retentionSeconds: 604800,
      topicName: mailSyncQueueTopic,
    });
    assert.equal(sendMock.mock.callCount(), 1);
    assert.equal(logMock.mock.callCount(), 1);
    assert.deepEqual(logMock.mock.calls[0]?.arguments, [
      {
        eventName: "mail_sync_enqueue_duplicate",
        eventType: "GMAIL_INCREMENTAL_SYNC_REQUESTED",
        idempotencyKey: "GMAIL_INCREMENTAL_SYNC_REQUESTED:mail-account-id:9876543210",
        mailAccountId: "mail-account-id",
      },
    ]);
  } finally {
    restoreSend();
    logMock.mock.restore();
  }
});

test("non-duplicate queue send errors are rethrown", async () => {
  const event: MailSyncEvent = {
    mailAccountId: "mail-account-id",
    type: "GMAIL_RENEW_WATCH_REQUESTED",
  };
  const error = new Error("queue unavailable");
  const sendMock = mock.fn(async () => {
    throw error;
  });
  const restoreSend = mockMailSyncQueueSendForTest(sendMock as typeof send);

  try {
    await assert.rejects(() => vercelMailSyncBroker.enqueueMailSyncEvent(event), error);
  } finally {
    restoreSend();
  }
});
