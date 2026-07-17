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

export function createPrismaClient(options?: {
  readonly connectionString?: string;
  readonly max?: number;
}) {
  const connectionString = options?.connectionString ?? env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required to create a Prisma client");
  }

  const adapter = new PrismaNeon({
    connectionString,
    ...(options?.max === undefined ? {} : { max: options.max }),
  });

  return new PrismaClient({ adapter });
}

const prisma = createPrismaClient();
export default prisma;
