import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, test } from "node:test";

import { loadPrismaCliDatabaseEnv } from "./prisma-config-env";

// Real-shaped Neon dev-branch URL (the value apps/web/.env.local carries).
const neonDevUrl =
  "postgresql://neondb_owner:npg_test-password@ep-old-dawn-aou3woud-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
const explicitLocalUrl = "postgresql://user:password@localhost:5432/test_db";
const sentinelKey = "PRISMA_CONFIG_ENV_TEST_SENTINEL";

let envDir: string;
let savedDatabaseUrl: string | undefined;
let savedNodeEnv: string | undefined;
let savedSentinel: string | undefined;

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

beforeEach(() => {
  envDir = mkdtempSync(path.join(tmpdir(), "prisma-config-env-"));
  savedDatabaseUrl = process.env.DATABASE_URL;
  savedNodeEnv = process.env.NODE_ENV;
  savedSentinel = process.env[sentinelKey];
  delete process.env.DATABASE_URL;
  delete process.env.NODE_ENV;
  delete process.env[sentinelKey];
});

afterEach(() => {
  rmSync(envDir, { force: true, recursive: true });
  restoreEnv("DATABASE_URL", savedDatabaseUrl);
  restoreEnv("NODE_ENV", savedNodeEnv);
  restoreEnv(sentinelKey, savedSentinel);
});

test("an explicit process-env DATABASE_URL always wins over the dotenv files", () => {
  writeFileSync(path.join(envDir, ".env.local"), `DATABASE_URL=${neonDevUrl}\n`);
  process.env.DATABASE_URL = explicitLocalUrl;

  loadPrismaCliDatabaseEnv(envDir);

  assert.equal(process.env.DATABASE_URL, explicitLocalUrl);
});

test("without an explicit DATABASE_URL, .env.local supplies it", () => {
  writeFileSync(path.join(envDir, ".env.local"), `DATABASE_URL=${neonDevUrl}\n`);

  loadPrismaCliDatabaseEnv(envDir);

  assert.equal(process.env.DATABASE_URL, neonDevUrl);
});

test(".env.development.local still overrides .env.local", () => {
  const developmentUrl = "postgresql://user:password@localhost:5432/dev_override_db";
  writeFileSync(path.join(envDir, ".env.local"), `DATABASE_URL=${neonDevUrl}\n`);
  writeFileSync(path.join(envDir, ".env.development.local"), `DATABASE_URL=${developmentUrl}\n`);

  loadPrismaCliDatabaseEnv(envDir);

  assert.equal(process.env.DATABASE_URL, developmentUrl);
});

test("non-DATABASE_URL vars from the dotenv files still override process env", () => {
  writeFileSync(path.join(envDir, ".env.local"), `${sentinelKey}=from-file\n`);
  process.env[sentinelKey] = "from-process";

  loadPrismaCliDatabaseEnv(envDir);

  assert.equal(process.env[sentinelKey], "from-file");
});

test("NODE_ENV=test without an explicit DATABASE_URL throws instead of reading dotenv", () => {
  writeFileSync(path.join(envDir, ".env.local"), `DATABASE_URL=${neonDevUrl}\n`);
  process.env.NODE_ENV = "test";

  assert.throws(() => loadPrismaCliDatabaseEnv(envDir), /DATABASE_URL/);
  assert.equal(process.env.DATABASE_URL, undefined);
});

test("NODE_ENV=test with an explicit DATABASE_URL keeps it and never reads dotenv", () => {
  writeFileSync(
    path.join(envDir, ".env.local"),
    `DATABASE_URL=${neonDevUrl}\n${sentinelKey}=from-file\n`,
  );
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = explicitLocalUrl;

  loadPrismaCliDatabaseEnv(envDir);

  assert.equal(process.env.DATABASE_URL, explicitLocalUrl);
  assert.equal(process.env[sentinelKey], undefined);
});
