// Preflight for schema/DB-mutating prisma commands. Aborts if DATABASE_URL
// points at the PROD Neon branch, unless ALLOW_PROD_DB=1 is set.
// Neon branch protection is paid-only, so this is our mechanical guard.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PROD_HOST = "ep-floral-tree-aokfe9q5-pooler.c-2.ap-southeast-1.aws.neon.tech";

function readDatabaseUrlFromEnvFile(path) {
  try {
    const text = readFileSync(path, "utf8");
    const match = text.match(/^\s*DATABASE_URL\s*=\s*["']?(.+?)["']?\s*$/m);
    return match ? match[1] : "";
  } catch {
    // file not present — caller tries the next candidate
    return "";
  }
}

function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  const here = dirname(fileURLToPath(import.meta.url));
  for (const rel of ["../../../apps/web/.env.local", "../../../apps/web/.env"]) {
    const url = readDatabaseUrlFromEnvFile(join(here, rel));
    if (url) {
      return url;
    }
  }
  return "";
}

const url = resolveDatabaseUrl();

if (url.includes(PROD_HOST) && process.env.ALLOW_PROD_DB !== "1") {
  console.error(
    `\n✖ Refusing to run a schema/DB-mutating command against PRODUCTION.\n` +
      `  DATABASE_URL host is ${PROD_HOST}.\n` +
      `  Point apps/web/.env.local DATABASE_URL at the Neon 'dev' branch, or set\n` +
      `  ALLOW_PROD_DB=1 to override (don't). Schema reaches prod via 'migrate deploy'\n` +
      `  in CI/Vercel — never a local push/migrate. See AGENTS.md.\n`,
  );
  process.exit(1);
}
