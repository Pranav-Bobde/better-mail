import assert from "node:assert/strict";
import test from "node:test";

import { demoOrpc } from "@/features/mail/demo/demo-orpc";

// The real orpc module builds its RPC link at import time and needs APP_URL
// when there is no window, so it is imported lazily after the env is set.
async function importRealOrpc() {
  process.env.APP_URL = process.env.APP_URL ?? "http://localhost:4000";

  return (await import("@/shared/utils/orpc")).orpc;
}

test("demo mail query keys match the real mail query keys", async () => {
  const orpc = await importRealOrpc();

  assert.deepEqual(demoOrpc.mail.getMailbox.key(), orpc.mail.getMailbox.key());
  assert.deepEqual(demoOrpc.mail.getThread.key(), orpc.mail.getThread.key());
  assert.deepEqual(demoOrpc.mail.listDrafts.key(), orpc.mail.listDrafts.key());
  assert.deepEqual(demoOrpc.mail.key(), orpc.mail.key());
});

test("demo mail keys match for scoped queries and mutations", async () => {
  const orpc = await importRealOrpc();
  const keyOptions = { input: { folder: "inbox" }, type: "query" } as const;

  assert.deepEqual(demoOrpc.mail.getMailbox.key(keyOptions), orpc.mail.getMailbox.key(keyOptions));
  assert.deepEqual(
    demoOrpc.mail.send.key({ type: "mutation" }),
    orpc.mail.send.key({ type: "mutation" }),
  );
  assert.deepEqual(
    demoOrpc.mail.setThreadRead.key({ type: "mutation" }),
    orpc.mail.setThreadRead.key({ type: "mutation" }),
  );
});

test("demo mail utils expose the query and mutation helpers the mail UI uses", () => {
  assert.equal(typeof demoOrpc.mail.getMailbox.queryOptions, "function");
  assert.equal(typeof demoOrpc.mail.getThread.queryOptions, "function");
  assert.equal(typeof demoOrpc.mail.send.mutationOptions, "function");
  assert.equal(typeof demoOrpc.mail.createDraft.mutationOptions, "function");
});

test("demo query options carry the demo mailbox key and resolve in the browser", async () => {
  const options = demoOrpc.mail.getMailbox.queryOptions({
    input: { folder: "inbox", query: "", view: "all" },
  });

  assert.deepEqual(
    options.queryKey,
    demoOrpc.mail.getMailbox.key({
      input: { folder: "inbox", query: "", view: "all" },
      type: "query",
    }),
  );

  const result = await demoOrpc.mail.getMailbox.call({ folder: "inbox", query: "", view: "all" });

  assert.equal(result.status, "ok");
  assert.equal(result.status === "ok" && result.data.messages.length, 17);
});
