import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("mail sync consumer stays isolated behind the Vercel queue trigger", () => {
  const config = JSON.parse(
    readFileSync(new URL("../../../vercel.json", import.meta.url), "utf8"),
  ) as {
    readonly functions?: Record<
      string,
      { readonly experimentalTriggers?: readonly Record<string, unknown>[] }
    >;
  };

  assert.deepEqual(
    config.functions?.["src/app/api/queues/mail-sync/route.ts"]?.experimentalTriggers,
    [{ type: "queue/v2beta", topic: "mail-sync" }],
  );
});
