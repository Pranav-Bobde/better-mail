import assert from "node:assert/strict";
import test from "node:test";

import { mailErrors } from "@code-main/api/mail/errors";

import {
  getMirrorWriteWarning,
  getMutationErrorPresentation,
  isGmailScopeMissingError,
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
  });
});

test("known catalog codes present their catalog message", () => {
  const presentation = getMutationErrorPresentation(mailErrors.GMAIL_MODIFY_THREAD_FAILED.code);

  assert.deepEqual(presentation, {
    kind: "generic",
    message: mailErrors.GMAIL_MODIFY_THREAD_FAILED.message,
  });
});

test("unknown codes fall back to a generic human message", () => {
  const presentation = getMutationErrorPresentation("mail.SOMETHING_NEW");

  assert.deepEqual(presentation, {
    kind: "generic",
    message: "Something went wrong. Please try again.",
  });
});

// Gmail accepted the write but the local cache mirror missed it: the API
// still returns ok with mirrorApplied: false, and the user must be told the
// optimistic change may briefly reappear — never a silent revert.
test("mirror-deferred ok results warn that the change may briefly reappear", () => {
  const warning = getMirrorWriteWarning({
    data: { mirrorApplied: false },
    status: "ok",
  });

  assert.equal(
    warning,
    "Saved to Gmail, but this change may briefly reappear until your mailbox finishes syncing.",
  );
});

test("fully applied ok results and error results produce no mirror warning", () => {
  assert.equal(
    getMirrorWriteWarning({
      data: { mirrorApplied: true },
      status: "ok",
    }),
    null,
  );
  assert.equal(
    getMirrorWriteWarning({
      error: "mail.GMAIL_MODIFY_THREAD_FAILED",
      status: "error",
    }),
    null,
  );
});
