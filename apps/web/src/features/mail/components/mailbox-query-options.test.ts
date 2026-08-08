import assert from "node:assert/strict";
import test from "node:test";

import * as mailboxQueryOptionsModule from "@/features/mail/components/mailbox-query-options";

const { createMailboxQueryOptions, shouldShowMailboxTransitionLoading } = mailboxQueryOptionsModule;

test("mailbox query options do not poll getMailbox", () => {
  const options = createMailboxQueryOptions({
    folder: "inbox",
    searchQuery: "",
    view: "all",
  });

  assert.equal("refetchInterval" in options, false);
  assert.equal(options.refetchOnReconnect, "always");
  assert.equal(options.refetchOnWindowFocus, "always");
  assert.deepEqual(options.context, { requestTrigger: "mailbox.load" });
});

test("mailbox query options carry explicit search and refresh trigger context", () => {
  const searchOptions = createMailboxQueryOptions({
    folder: "inbox",
    searchQuery: "project",
    view: "all",
  });
  const refreshOptions = createMailboxQueryOptions(
    {
      folder: "inbox",
      searchQuery: "",
      view: "all",
    },
    "mailbox.refresh",
  );

  assert.deepEqual(searchOptions.context, { requestTrigger: "mailbox.search" });
  assert.deepEqual(refreshOptions.context, { requestTrigger: "mailbox.refresh" });
});

test("mailboxChanged invalidates the mailbox query and ignores malformed events", async () => {
  const createMailboxChangedHandler = (mailboxQueryOptionsModule as Record<string, unknown>)
    .createMailboxChangedHandler;

  assert.equal(typeof createMailboxChangedHandler, "function");

  const invalidations: string[] = [];
  const handler = (
    createMailboxChangedHandler as (
      invalidateMailbox: (trigger: string) => Promise<void>,
    ) => (event: unknown) => Promise<void>
  )(async (trigger) => {
    invalidations.push(trigger);
  });

  await handler({
    mailAccountId: "mail-account-id",
    mailboxVersion: "176009",
    type: "mailboxChanged",
  });
  await handler({ type: "unknown" });

  assert.deepEqual(invalidations, ["mailbox.realtime"]);
});

test("search transition hides placeholder rows while ordinary refresh keeps current rows", () => {
  assert.equal(
    shouldShowMailboxTransitionLoading({
      isFetching: true,
      isPlaceholderData: true,
    }),
    true,
  );
  assert.equal(
    shouldShowMailboxTransitionLoading({
      isFetching: true,
      isPlaceholderData: false,
    }),
    false,
  );
});
