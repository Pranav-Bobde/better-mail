import assert from "node:assert/strict";

import { test } from "vitest";

import {
  assertConfirmedDevNeonDatabaseUrl,
  confirmedDevNeonHost,
} from "./dev-neon-integration-guard";

const confirmedDevUrl = `postgresql://test:test@${confirmedDevNeonHost}/neondb?sslmode=require`;

test("allows only the confirmed dev Neon database", () => {
  assert.equal(assertConfirmedDevNeonDatabaseUrl(confirmedDevUrl).hostname, confirmedDevNeonHost);
});

test.each([
  "postgresql://test:test@ep-floral-tree-aokfe9q5-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb",
  "postgresql://test:test@ep-delicate-band-aongl5fw-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb",
  "postgresql://test:test@localhost:5432/neondb",
  `postgresql://test:test@${confirmedDevNeonHost}.attacker.invalid/neondb`,
])("refuses every non-dev or lookalike database host: %s", (databaseUrl) => {
  assert.throws(
    () => assertConfirmedDevNeonDatabaseUrl(databaseUrl),
    /Refusing dev Neon integration test/,
  );
});

test("refuses a non-Postgres URL or wrong database on the dev host", () => {
  assert.throws(
    () => assertConfirmedDevNeonDatabaseUrl(`https://${confirmedDevNeonHost}/neondb`),
    /Refusing dev Neon integration test/,
  );
  assert.throws(
    () =>
      assertConfirmedDevNeonDatabaseUrl(
        `postgresql://test:test@${confirmedDevNeonHost}/another_database`,
      ),
    /Refusing dev Neon integration test/,
  );
});
