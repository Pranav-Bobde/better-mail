import prisma from "@code-main/db";
import { EvlogError } from "evlog";
import MailChecker from "mailchecker";
import type { z } from "zod";

import type { Context } from "../../../context";
import { createRpcSuccessFields } from "../../../observability/rpc/fields";
import { waitlistErrors } from "../../../waitlist/errors";
import { hashIp, normalizeEmail } from "../../../waitlist/normalize";
import type { waitlistJoinInputSchema } from "./constants";

const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX_PER_IP = 8;

type JoinInput = z.infer<typeof waitlistJoinInputSchema>;

async function positionOf(createdAt: Date) {
  return prisma.waitlistEntry.count({ where: { createdAt: { lte: createdAt } } });
}

// Honeypot filled → almost certainly a bot.
function isHoneypotTripped(input: JoinInput) {
  return Boolean(input.hp && input.hp.trim().length > 0);
}

// Pretend it worked, store nothing.
async function honeypotSuccess(context: Context) {
  context.log.set(createRpcSuccessFields("waitlist.join"));
  const position = await prisma.waitlistEntry.count();
  return { data: { position, alreadyJoined: false }, status: "ok" as const };
}

// Format + disposable/throwaway check (mailchecker: same lib the better-auth
// spam plugins wrap).
function assertDeliverableEmail(email: string) {
  if (!MailChecker.isValid(email)) {
    throw waitlistErrors.DISPOSABLE_EMAIL();
  }
}

async function assertUnderIpRateLimit(ipHash: string | null) {
  if (!ipHash) {
    return;
  }
  const recent = await prisma.waitlistEntry.count({
    where: { ipHash, createdAt: { gte: new Date(Date.now() - RATE_WINDOW_MS) } },
  });
  if (recent >= RATE_MAX_PER_IP) {
    throw waitlistErrors.RATE_LIMITED();
  }
}

async function findOrCreateEntry(input: JoinInput, ipHash: string | null) {
  const normalizedEmail = normalizeEmail(input.email);
  const existing = await prisma.waitlistEntry.findUnique({ where: { normalizedEmail } });
  const entry =
    existing ??
    (await prisma.waitlistEntry.create({
      data: {
        email: input.email.trim().toLowerCase(),
        normalizedEmail,
        source: input.source ?? null,
        ipHash,
      },
    }));
  return { entry, alreadyJoined: Boolean(existing) };
}

function toJoinFailure(error: unknown) {
  if (error instanceof EvlogError) {
    return error;
  }
  return waitlistErrors.JOIN_FAILED({ cause: error instanceof Error ? error : undefined });
}

export async function runJoinWaitlist(input: JoinInput, context: Context) {
  try {
    if (isHoneypotTripped(input)) {
      // await inside try so a DB failure here is caught/logged, not leaked.
      return await honeypotSuccess(context);
    }

    assertDeliverableEmail(input.email);

    const ipHash = hashIp(context.requestIp);
    await assertUnderIpRateLimit(ipHash);

    const { entry, alreadyJoined } = await findOrCreateEntry(input, ipHash);
    const position = await positionOf(entry.createdAt);
    context.log.set(createRpcSuccessFields("waitlist.join"));
    return {
      data: { position, alreadyJoined },
      status: "ok" as const,
    };
  } catch (error) {
    const evlogError = toJoinFailure(error);
    context.log.error(evlogError);
    return { error: evlogError.code ?? waitlistErrors.JOIN_FAILED.code, status: "error" as const };
  }
}
