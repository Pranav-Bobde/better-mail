import assert from "node:assert/strict";
import test from "node:test";

import { createRpcRequestDiagnosticHeaders } from "@/shared/utils/rpc-request-diagnostics";

test("concurrent mailbox search and refresh requests keep distinct safe correlation metadata", async () => {
  const privateQuery = "from:private-sender@example.com project-codename";

  const [searchHeaders, refreshHeaders] = await Promise.all([
    Promise.resolve().then(() =>
      createRpcRequestDiagnosticHeaders({
        context: { requestTrigger: "mailbox.search" },
        createRequestId: () => "018f47a0-5e4b-7d5a-8f0a-111111111111",
        input: {
          folder: "inbox",
          query: privateQuery,
          view: "all",
        },
        path: ["mail", "getMailbox"],
      }),
    ),
    Promise.resolve().then(() =>
      createRpcRequestDiagnosticHeaders({
        context: { requestTrigger: "mailbox.refresh" },
        createRequestId: () => "018f47a0-5e4b-7d5a-8f0a-222222222222",
        input: {
          folder: "inbox",
          query: "",
          view: "all",
        },
        path: ["mail", "getMailbox"],
      }),
    ),
  ]);

  assert.deepEqual(searchHeaders, {
    "x-better-mail-client-request-id": "018f47a0-5e4b-7d5a-8f0a-111111111111",
    "x-better-mail-request-trigger": "mailbox.search",
  });
  assert.deepEqual(refreshHeaders, {
    "x-better-mail-client-request-id": "018f47a0-5e4b-7d5a-8f0a-222222222222",
    "x-better-mail-request-trigger": "mailbox.refresh",
  });
  assert.equal(JSON.stringify([searchHeaders, refreshHeaders]).includes(privateQuery), false);
});

test("non-mailbox requests use generic RPC trigger without retaining input", () => {
  const privateBody = "private email body";
  const headers = createRpcRequestDiagnosticHeaders({
    createRequestId: () => "018f47a0-5e4b-7d5a-8f0a-333333333333",
    input: { body: privateBody },
    path: ["mail", "send"],
  });

  assert.equal(headers["x-better-mail-request-trigger"], "rpc.request");
  assert.equal(JSON.stringify(headers).includes(privateBody), false);
});

test("mailbox request trigger comes from per-call context, including load and realtime", async () => {
  const [loadHeaders, realtimeHeaders] = await Promise.all([
    Promise.resolve().then(() =>
      createRpcRequestDiagnosticHeaders({
        context: { requestTrigger: "mailbox.load" },
        createRequestId: () => "018f47a0-5e4b-7d5a-8f0a-444444444444",
        input: { query: "" },
        path: ["mail", "getMailbox"],
      }),
    ),
    Promise.resolve().then(() =>
      createRpcRequestDiagnosticHeaders({
        context: { requestTrigger: "mailbox.realtime" },
        createRequestId: () => "018f47a0-5e4b-7d5a-8f0a-555555555555",
        input: { query: "" },
        path: ["mail", "getMailbox"],
      }),
    ),
  ]);

  assert.equal(loadHeaders["x-better-mail-request-trigger"], "mailbox.load");
  assert.equal(realtimeHeaders["x-better-mail-request-trigger"], "mailbox.realtime");
});
