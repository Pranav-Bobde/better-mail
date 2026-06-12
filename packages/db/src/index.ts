import { env } from "@code-main/env/server";
import { PrismaNeon } from "@prisma/adapter-neon";

import { PrismaClient } from "../prisma/generated/client";

export function createPrismaClient() {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to create a Prisma client");
  }

  const adapter = new PrismaNeon({
    connectionString: env.DATABASE_URL,
  });

  return new PrismaClient({ adapter });
}

const prisma = createPrismaClient();
export default prisma;
