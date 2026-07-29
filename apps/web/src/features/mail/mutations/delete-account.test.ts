import assert from "node:assert/strict";
import test from "node:test";

import {
  getDeleteAccountErrorMessage,
  getDeleteAccountLabel,
} from "@/features/mail/mutations/delete-account";

test("stale-session deletion errors tell the user to re-authenticate", () => {
  // Better Auth rejects deletion on a stale session with SESSION_EXPIRED
  // ("Session expired. Re-authenticate to perform this action.").
  const byCode = getDeleteAccountErrorMessage({ code: "SESSION_EXPIRED", message: null });
  const byMessage = getDeleteAccountErrorMessage({
    code: null,
    message: "Session expired. Re-authenticate to perform this action.",
  });

  assert.match(byCode, /sign out and back in/i);
  assert.equal(byMessage, byCode);
});

test("other deletion errors fall back to a generic retry message", () => {
  assert.match(getDeleteAccountErrorMessage({ code: "UNAUTHORIZED", message: null }), /try again/i);
  assert.match(getDeleteAccountErrorMessage(null), /try again/i);
});

test("delete-account label switches to an explicit confirm step", () => {
  assert.equal(getDeleteAccountLabel(false), "Delete account");
  assert.equal(getDeleteAccountLabel(true), "Confirm delete account");
});
