import { env } from "@code-main/env/server";
import { PrismaNeon } from "@prisma/adapter-neon";

import { PrismaClient } from "../prisma/generated/client";

export { Prisma } from "../prisma/generated/client";
export type { PrismaClient } from "../prisma/generated/client";
export {
  MailAccountSyncStatus,
  MailProvider,
  MailSyncCursorKind,
  MailSyncScopeType,
} from "../prisma/generated/enums";

/**
 * The Neon driver pools 10 connections by default. One mailbox fetch writes up to 20
 * threads concurrently and each holds a connection for a whole interactive transaction,
 * so the default leaves 10 writes queueing until Prisma's ~2s maxWait expires (P2028).
 * Co-locating functions with the database made transactions fast enough to hide this,
 * but 20 concurrent writers against 10 connections is still the shape of the code.
 * Neon is nowhere near the limit either way: max_connections is 901 on this compute.
 */
const connectionPoolMax = 25;

export function createPrismaClient() {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to create a Prisma client");
  }

  const adapter = new PrismaNeon({
    connectionString: env.DATABASE_URL,
    max: connectionPoolMax,
  });

  return new PrismaClient({ adapter });
}

const prisma = createPrismaClient();
export default prisma;
