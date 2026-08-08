import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { Schema } from "effect";
import { test } from "vitest";

import { gmailThreadResponseSchema } from "../gmail-schemas";
import { assertConfirmedDevNeonDatabaseUrl } from "./dev-neon-integration-guard";

const runDevNeonIntegration = process.env.RUN_DEV_NEON_INTEGRATION === "1";
const devNeonTest = runDevNeonIntegration ? test : test.skip;

devNeonTest(
  "real dev Neon rejects stale snapshots after read and archive cache writes",
  async () => {
    if (!process.env.DATABASE_URL) {
      process.loadEnvFile(new URL("../../../../../apps/web/.env.local", import.meta.url));
    }
    const databaseUrl = process.env.DATABASE_URL;
    assert.ok(databaseUrl, "DATABASE_URL is required for the dev Neon integration test");
    assertConfirmedDevNeonDatabaseUrl(databaseUrl);

    const [{ default: prisma }, { createPrismaMailSyncRepository }] = await Promise.all([
      import("@code-main/db"),
      import("./prisma-mail-sync-repository"),
    ]);
    const repository = createPrismaMailSyncRepository(prisma);
    const runId = randomUUID();
    const userId = `dev-neon-cache-test-${runId}`;
    const mailAccountId = `dev-neon-mail-account-${runId}`;
    const readThreadId = `dev-neon-read-thread-${runId}`;
    const archiveThreadId = `dev-neon-archive-thread-${runId}`;

    try {
      await prisma.user.create({
        data: {
          email: `${userId}@example.invalid`,
          emailVerified: true,
          id: userId,
          name: "Dev Neon cache integration test",
        },
      });
      await prisma.mailAccount.create({
        data: {
          email: `${userId}@example.invalid`,
          id: mailAccountId,
          providerAccountId: userId,
          userId,
        },
      });

      const readFixture = await seedCachedThread(prisma, {
        historyId: 100n,
        labelId: "UNREAD",
        mailAccountId,
        providerThreadId: readThreadId,
        read: false,
      });
      const archiveFixture = await seedCachedThread(prisma, {
        historyId: 200n,
        inbox: true,
        labelId: "INBOX",
        mailAccountId,
        providerThreadId: archiveThreadId,
      });

      await repository.markCachedThreadReadState({
        historyId: "101",
        read: true,
        threadId: readThreadId,
        userId,
      });

      assert.deepEqual(await threadState(prisma, readFixture.threadId, "UNREAD", "isRead"), {
        labelCount: 0,
        providerHistoryId: 101n,
        state: true,
        subject: "Seed subject",
      });

      await repository.applyGmailThread({
        latestMessageId: readFixture.providerMessageId,
        mailAccountId,
        thread: createGmailThreadSnapshot({
          historyId: "100",
          labelIds: ["INBOX", "UNREAD"],
          messageId: readFixture.providerMessageId,
          subject: "Stale read snapshot must not apply",
          threadId: readThreadId,
        }),
        threadId: readThreadId,
      });

      assert.deepEqual(await threadState(prisma, readFixture.threadId, "UNREAD", "isRead"), {
        labelCount: 0,
        providerHistoryId: 101n,
        state: true,
        subject: "Seed subject",
      });

      await repository.applyGmailThread({
        latestMessageId: readFixture.providerMessageId,
        mailAccountId,
        thread: createGmailThreadSnapshot({
          historyId: "102",
          labelIds: ["INBOX", "UNREAD"],
          messageId: readFixture.providerMessageId,
          subject: "Newer read snapshot applied",
          threadId: readThreadId,
        }),
        threadId: readThreadId,
      });

      await repository.markCachedThreadReadState({
        historyId: "101",
        read: true,
        threadId: readThreadId,
        userId,
      });

      assert.deepEqual(await threadState(prisma, readFixture.threadId, "UNREAD", "isRead"), {
        labelCount: 1,
        providerHistoryId: 102n,
        state: false,
        subject: "Newer read snapshot applied",
      });

      await repository.markCachedThreadArchived({
        historyId: "201",
        threadId: archiveThreadId,
        userId,
      });

      assert.deepEqual(await threadState(prisma, archiveFixture.threadId, "INBOX", "isInbox"), {
        labelCount: 0,
        providerHistoryId: 201n,
        state: false,
        subject: "Seed subject",
      });

      await repository.applyGmailThread({
        latestMessageId: archiveFixture.providerMessageId,
        mailAccountId,
        thread: createGmailThreadSnapshot({
          historyId: "200",
          labelIds: ["INBOX"],
          messageId: archiveFixture.providerMessageId,
          subject: "Stale archive snapshot must not apply",
          threadId: archiveThreadId,
        }),
        threadId: archiveThreadId,
      });

      assert.deepEqual(await threadState(prisma, archiveFixture.threadId, "INBOX", "isInbox"), {
        labelCount: 0,
        providerHistoryId: 201n,
        state: false,
        subject: "Seed subject",
      });

      await repository.applyGmailThread({
        latestMessageId: archiveFixture.providerMessageId,
        mailAccountId,
        thread: createGmailThreadSnapshot({
          historyId: "202",
          labelIds: ["INBOX"],
          messageId: archiveFixture.providerMessageId,
          subject: "Newer archive snapshot applied",
          threadId: archiveThreadId,
        }),
        threadId: archiveThreadId,
      });

      await repository.markCachedThreadArchived({
        historyId: "201",
        threadId: archiveThreadId,
        userId,
      });

      assert.deepEqual(await threadState(prisma, archiveFixture.threadId, "INBOX", "isInbox"), {
        labelCount: 1,
        providerHistoryId: 202n,
        state: true,
        subject: "Newer archive snapshot applied",
      });
    } finally {
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.$disconnect();
    }
  },
  30_000,
);

type DevNeonPrisma = Awaited<typeof import("@code-main/db")>["default"];

async function seedCachedThread(
  prisma: DevNeonPrisma,
  input: {
    readonly historyId: bigint;
    readonly inbox?: boolean;
    readonly labelId: "INBOX" | "UNREAD";
    readonly mailAccountId: string;
    readonly providerThreadId: string;
    readonly read?: boolean;
  },
) {
  const thread = await prisma.mailThread.create({
    data: {
      isInbox: input.inbox ?? false,
      isRead: input.read ?? true,
      mailAccountId: input.mailAccountId,
      messageCount: 1,
      providerHistoryId: input.historyId,
      providerThreadId: input.providerThreadId,
    },
  });
  const providerMessageId = `${input.providerThreadId}-message`;
  const message = await prisma.mailMessage.create({
    data: {
      bccRecipients: [],
      ccRecipients: [],
      fromEmail: "sender@example.invalid",
      fromName: "Integration Sender",
      mailAccountId: input.mailAccountId,
      mailThreadId: thread.id,
      providerMessageId,
      sentAt: new Date("2026-08-05T00:00:00.000Z"),
      subject: "Seed subject",
      textBody: "Seed body",
      toRecipients: [{ email: "receiver@example.invalid", name: "Integration Receiver" }],
    },
  });
  const label = await prisma.mailLabel.create({
    data: {
      mailAccountId: input.mailAccountId,
      name: input.labelId,
      providerLabelId: input.labelId,
      type: "system",
    },
  });
  await prisma.mailMessageLabel.create({
    data: { mailLabelId: label.id, mailMessageId: message.id },
  });

  return { providerMessageId, threadId: thread.id };
}

function createGmailThreadSnapshot(input: {
  readonly historyId: string;
  readonly labelIds: readonly string[];
  readonly messageId: string;
  readonly subject: string;
  readonly threadId: string;
}) {
  return Schema.decodeUnknownSync(gmailThreadResponseSchema)({
    historyId: input.historyId,
    id: input.threadId,
    messages: [
      {
        historyId: input.historyId,
        id: input.messageId,
        internalDate: "1785888000000",
        labelIds: input.labelIds,
        payload: {
          body: {
            data: Buffer.from("Authoritative snapshot body", "utf8").toString("base64url"),
            size: 27,
          },
          headers: [
            { name: "From", value: "Integration Sender <sender@example.invalid>" },
            { name: "To", value: "Integration Receiver <receiver@example.invalid>" },
            { name: "Subject", value: input.subject },
            { name: "Message-ID", value: `<${input.messageId}@mail.gmail.com>` },
          ],
          mimeType: "text/plain",
        },
        sizeEstimate: 512,
        snippet: "Authoritative snapshot body",
        threadId: input.threadId,
      },
    ],
  });
}

async function threadState(
  prisma: DevNeonPrisma,
  threadId: string,
  labelId: string,
  stateField: "isInbox" | "isRead",
) {
  const [thread, labelCount, message] = await Promise.all([
    prisma.mailThread.findUniqueOrThrow({ where: { id: threadId } }),
    countThreadLabel(prisma, threadId, labelId),
    prisma.mailMessage.findFirstOrThrow({ where: { mailThreadId: threadId } }),
  ]);

  return {
    labelCount,
    providerHistoryId: thread.providerHistoryId,
    state: thread[stateField],
    subject: message.subject,
  };
}

function countThreadLabel(prisma: DevNeonPrisma, threadId: string, labelId: string) {
  return prisma.mailMessageLabel.count({
    where: {
      label: { providerLabelId: labelId },
      message: { mailThreadId: threadId },
    },
  });
}
