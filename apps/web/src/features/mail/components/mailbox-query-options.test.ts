import assert from "node:assert/strict";
import test from "node:test";

import * as mailboxQueryOptionsModule from "@/features/mail/components/mailbox-query-options";

const { createMailboxQueryOptions } = mailboxQueryOptionsModule;

test("mailbox query options do not poll getMailbox", () => {
  const options = createMailboxQueryOptions({
    searchQuery: "",
    view: "all",
  });

  assert.equal("refetchInterval" in options, false);
  assert.equal(options.refetchOnReconnect, "always");
  assert.equal(options.refetchOnWindowFocus, "always");
});

test("mailboxChanged invalidates the mailbox query and ignores malformed events", async () => {
  const createMailboxChangedHandler = (mailboxQueryOptionsModule as Record<string, unknown>)
    .createMailboxChangedHandler;

  assert.equal(typeof createMailboxChangedHandler, "function");

  const invalidations: string[] = [];
  const handler = (
    createMailboxChangedHandler as (
      invalidateMailbox: () => Promise<void>,
    ) => (event: unknown) => Promise<void>
  )(async () => {
    invalidations.push("getMailbox");
  });

  await handler({
    mailAccountId: "mail-account-id",
    mailboxVersion: "176009",
    type: "mailboxChanged",
  });
  await handler({ type: "unknown" });

  assert.deepEqual(invalidations, ["getMailbox"]);
});
