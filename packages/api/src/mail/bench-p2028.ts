/**
 * TEMPORARY diagnostic. Delete once the P2028 region measurement is signed off.
 *
 * Mirrors temp/bench/p2028-bench.ts so the numbers are directly comparable. The local
 * script measured a laptop's distance to Neon; running this from inside a deployed
 * function measures the lambda's distance to Neon, which is what the sin1 region change
 * actually altered. Same cells, same real-shaped fixture, fewer trials to fit inside the
 * function time limit.
 */
import { createPrismaClient } from "@code-main/db";
import { performance } from "node:perf_hooks";

import { gmailThreadResponseSchema } from "./gmail-schemas";
import { createPrismaMailSyncRepository } from "./sync/prisma-mail-sync-repository";

const threadsPerTrial = 20;

const cells = [
  { concurrency: 20, option: "baseline", poolMax: 10 },
  { concurrency: 1, option: "serialize", poolMax: 10 },
  { concurrency: 5, option: "bounded", poolMax: 10 },
  { concurrency: 20, option: "raise pool", poolMax: 25 },
  { concurrency: 5, option: "raise pool + bounded", poolMax: 25 },
] as const;

export async function runP2028Bench(input: {
  readonly connectionString: string;
  readonly trialsPerCell: number;
}) {
  const results = [];

  for (const cell of cells) {
    results.push(await runCell(cell, input));
  }

  return { results, threadsPerTrial, trialsPerCell: input.trialsPerCell };
}

async function runCell(
  cell: (typeof cells)[number],
  input: { readonly connectionString: string; readonly trialsPerCell: number },
) {
  const client = createPrismaClient({
    connectionString: input.connectionString,
    max: cell.poolMax,
  });
  const repository = createPrismaMailSyncRepository(client);
  const wallDurationsMs: number[] = [];
  const successDurationsMs: number[] = [];
  const unexpectedErrors: string[] = [];
  let successes = 0;
  let failures = 0;
  let p2028 = 0;

  try {
    for (let trial = 0; trial < input.trialsPerCell; trial += 1) {
      const trialId = `${cell.poolMax}-${cell.concurrency}-${trial}-${crypto.randomUUID()}`;
      const inputs = await seedTrial(client, repository, trialId);
      const wallStartedAt = performance.now();

      const outcomes = await runWithConcurrency(inputs, cell.concurrency, async (threadInput) => {
        const startedAt = performance.now();

        try {
          await repository.applyGmailThread(threadInput);
          return { durationMs: performance.now() - startedAt, ok: true as const };
        } catch (error) {
          return { error, ok: false as const };
        }
      });

      wallDurationsMs.push(performance.now() - wallStartedAt);

      for (const outcome of outcomes) {
        if (outcome.ok) {
          successes += 1;
          successDurationsMs.push(outcome.durationMs);
          continue;
        }

        failures += 1;

        if (getErrorCode(outcome.error) === "P2028") {
          p2028 += 1;
          continue;
        }

        unexpectedErrors.push(describeError(outcome.error));
      }
    }
  } finally {
    await client.$disconnect();
  }

  return {
    concurrency: cell.concurrency,
    failures,
    option: cell.option,
    p2028,
    poolMax: cell.poolMax,
    successes,
    txMedianMs: percentile(successDurationsMs, 50),
    txP95Ms: percentile(successDurationsMs, 95),
    unexpectedErrors,
    wallMedianMs: percentile(wallDurationsMs, 50),
    wallP95Ms: percentile(wallDurationsMs, 95),
  };
}

async function seedTrial(
  client: ReturnType<typeof createPrismaClient>,
  repository: ReturnType<typeof createPrismaMailSyncRepository>,
  trialId: string,
) {
  const userId = `bench-user-${trialId}`;
  const email = `${userId}@example.com`;

  await client.user.create({
    data: { email, emailVerified: true, id: userId, name: "P2028 benchmark user" },
  });
  await client.account.create({
    data: {
      accountId: `bench-provider-${trialId}`,
      id: `bench-auth-${trialId}`,
      providerId: "google",
      userId,
    },
  });

  const mailAccount = await repository.upsertGmailMailAccount({
    email,
    historyId: `history-${trialId}`,
    userId,
  });

  if (!mailAccount) {
    throw new Error(`Failed to seed mail account for ${trialId}`);
  }

  return Array.from({ length: threadsPerTrial }, (_, index) => {
    const thread = gmailThreadResponseSchema.parse(
      createRealShapedGmailThread(`${trialId}-${index}`),
    );
    const latestMessage = thread.messages.at(-1);

    if (!latestMessage) {
      throw new Error("Real-shaped Gmail thread fixture has no messages");
    }

    return {
      latestMessageId: latestMessage.id,
      mailAccountId: mailAccount.id,
      thread,
      threadId: thread.id,
    };
  });
}

function createRealShapedGmailThread(idSuffix: string) {
  const threadId = `thread-${idSuffix}`;
  const firstMessageId = `message-${idSuffix}-1`;
  const latestMessageId = `message-${idSuffix}-2`;

  return {
    historyId: "176009",
    id: threadId,
    messages: [
      {
        historyId: "176008",
        id: firstMessageId,
        internalDate: "1760184330000",
        labelIds: ["INBOX"],
        payload: {
          body: { data: Buffer.from("Older body", "utf8").toString("base64url"), size: 10 },
          headers: [
            { name: "From", value: "Sender <sender@example.com>" },
            { name: "To", value: "Demo User <demo-user@example.com>" },
            { name: "Subject", value: "Project update" },
            { name: "Date", value: "Sat, 13 Jun 2026 10:45:30 +0530" },
            { name: "Message-ID", value: `<${firstMessageId}@example.com>` },
          ],
          mimeType: "text/plain",
        },
        sizeEstimate: 1000,
        snippet: "Older body",
        threadId,
      },
      {
        historyId: "176009",
        id: latestMessageId,
        internalDate: "1760187930000",
        labelIds: ["INBOX", "UNREAD", "IMPORTANT"],
        payload: {
          body: { data: Buffer.from("Latest body", "utf8").toString("base64url"), size: 11 },
          headers: [
            { name: "From", value: "Sender <sender@example.com>" },
            { name: "To", value: "Demo User <demo-user@example.com>" },
            { name: "Subject", value: "Re: Project update" },
            { name: "Date", value: "Sat, 13 Jun 2026 11:45:30 +0530" },
            { name: "Message-ID", value: `<${latestMessageId}@example.com>` },
            { name: "In-Reply-To", value: `<${firstMessageId}@example.com>` },
            { name: "References", value: `<${firstMessageId}@example.com>` },
          ],
          mimeType: "text/plain",
        },
        sizeEstimate: 1200,
        snippet: "Latest body",
        threadId,
      },
    ],
  };
}

async function runWithConcurrency<Input, Output>(
  inputs: readonly Input[],
  concurrency: number,
  run: (input: Input) => Promise<Output>,
) {
  const outputs: Output[] = Array.from({ length: inputs.length });
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: Math.min(concurrency, inputs.length) }, async () => {
      while (nextIndex < inputs.length) {
        const index = nextIndex;
        nextIndex += 1;
        const input = inputs[index];

        if (input !== undefined) {
          outputs[index] = await run(input);
        }
      }
    }),
  );

  return outputs;
}

function getErrorCode(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }

  return typeof error.code === "string" ? error.code : undefined;
}

function describeError(error: unknown) {
  return error instanceof Error
    ? `${error.name}: ${error.message.replaceAll("\n", " ")}`
    : String(error);
}

function percentile(values: readonly number[], percentileValue: number) {
  if (values.length === 0) {
    return null;
  }

  const sorted = values.toSorted((left, right) => left - right);
  const index = Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1);
  return Number((sorted[index] ?? 0).toFixed(1));
}
