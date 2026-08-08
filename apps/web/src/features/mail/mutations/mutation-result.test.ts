import assert from "node:assert/strict";
import test from "node:test";

import { mailErrors } from "@code-main/api/mail/errors";

import {
  getCacheWriteWarning,
  getMutationErrorPresentation,
  isGmailScopeMissingError,
  shouldRefreshDraftQueriesAfterMutation,
  shouldInvalidateAfterCacheWrite,
} from "@/features/mail/mutations/mutation-result";

test("isGmailScopeMissingError matches the catalog scope-missing code exactly", () => {
  // The wire code comes from evlog's defineErrorCatalog: `${prefix}.${KEY}`.
  assert.equal(mailErrors.GMAIL_SCOPE_MISSING.code, "mail.GMAIL_SCOPE_MISSING");

  assert.equal(isGmailScopeMissingError(mailErrors.GMAIL_SCOPE_MISSING.code), true);
  assert.equal(isGmailScopeMissingError("GMAIL_SCOPE_MISSING"), false);
  assert.equal(isGmailScopeMissingError("mail.GMAIL_SEND_MESSAGE_FAILED"), false);
  assert.equal(isGmailScopeMissingError(""), false);
});

test("scope-missing errors present as a reconnect prompt", () => {
  const presentation = getMutationErrorPresentation(mailErrors.GMAIL_SCOPE_MISSING.code);

  assert.deepEqual(presentation, {
    kind: "reconnect",
    message: "Gmail needs updated permissions",
    title: "Gmail needs reconnect",
  });
});

for (const [errorCode, expectedCode] of [
  [mailErrors.GMAIL_ACCESS_TOKEN_REQUEST_FAILED.code, "mail.GMAIL_ACCESS_TOKEN_REQUEST_FAILED"],
  [mailErrors.GMAIL_ACCOUNT_NOT_CONNECTED.code, "mail.GMAIL_ACCOUNT_NOT_CONNECTED"],
] as const) {
  test(`${expectedCode} presents as a reconnect prompt`, () => {
    assert.equal(errorCode, expectedCode);
    assert.deepEqual(getMutationErrorPresentation(errorCode), {
      kind: "reconnect",
      message: "Gmail needs updated permissions",
      title: "Gmail needs reconnect",
    });
  });
}

test("known catalog codes present their catalog message", () => {
  const presentation = getMutationErrorPresentation(mailErrors.GMAIL_MODIFY_THREAD_FAILED.code);

  assert.deepEqual(presentation, {
    kind: "generic",
    message: mailErrors.GMAIL_MODIFY_THREAD_FAILED.message,
    title: "Mailbox temporarily unavailable",
  });
});

test("mailbox cache conflicts present as retryable failures, not reconnect prompts", () => {
  const presentation = getMutationErrorPresentation("mail.MAIL_CACHE_WRITE_CONFLICT");

  assert.deepEqual(presentation, {
    kind: "generic",
    message: "Mailbox cache write conflicted",
    title: "Mailbox temporarily unavailable",
  });
});

test("unknown codes fall back to a generic human message", () => {
  const presentation = getMutationErrorPresentation("mail.SOMETHING_NEW");

  assert.deepEqual(presentation, {
    kind: "generic",
    message: "Something went wrong. Please try again.",
    title: "Mailbox temporarily unavailable",
  });
});

// Gmail accepted the write but the local cache missed it: the API
// still returns ok with cacheApplied: false, and the user must be told the
// optimistic change may briefly reappear — never a silent revert.
test("cache-deferred ok results warn that the change may briefly reappear", () => {
  const warning = getCacheWriteWarning({
    data: { cacheApplied: false },
    status: "ok",
  });

  assert.equal(
    warning,
    "Saved to Gmail, but this change may briefly reappear until your mailbox finishes syncing.",
  );
});

test("fully applied ok results and error results produce no cache warning", () => {
  assert.equal(
    getCacheWriteWarning({
      data: { cacheApplied: true },
      status: "ok",
    }),
    null,
  );
  assert.equal(
    getCacheWriteWarning({
      error: "mail.GMAIL_MODIFY_THREAD_FAILED",
      status: "error",
    }),
    null,
  );
});

test("an older response without cacheApplied is not treated as an explicit cache failure", () => {
  assert.equal(
    getCacheWriteWarning({
      data: {},
      status: "ok",
    }),
    null,
  );
});

test("auto-read can suppress a cache warning without hiding manual-action warnings", () => {
  const result = {
    data: { cacheApplied: false },
    status: "ok" as const,
  };

  assert.notEqual(getCacheWriteWarning(result), null);
  assert.equal(getCacheWriteWarning(result, { suppress: true }), null);
});

test("a confirmed cache miss keeps optimistic state instead of refetching stale rows", () => {
  assert.equal(
    shouldInvalidateAfterCacheWrite({ data: { cacheApplied: false }, status: "ok" }),
    false,
  );
  assert.equal(
    shouldInvalidateAfterCacheWrite({ data: { cacheApplied: true }, status: "ok" }),
    true,
  );
  assert.equal(shouldInvalidateAfterCacheWrite({ data: {}, status: "ok" }), true);
  assert.equal(
    shouldInvalidateAfterCacheWrite({
      error: "mail.GMAIL_MODIFY_THREAD_FAILED",
      status: "error",
    }),
    false,
  );
});

test("draft queries refresh after Gmail succeeds even when cache write is deferred", () => {
  assert.equal(
    shouldRefreshDraftQueriesAfterMutation({
      data: { cacheApplied: false },
      status: "ok",
    }),
    true,
  );
  assert.equal(
    shouldRefreshDraftQueriesAfterMutation({
      error: "mail.GMAIL_MODIFY_THREAD_FAILED",
      status: "error",
    }),
    false,
  );
});
