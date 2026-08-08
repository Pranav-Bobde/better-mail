import { mailErrors } from "@code-main/api/mail/errors";

// Mail write-action envelopes resolve HTTP 200 with { status: "error", error }
// where `error` is an evlog catalog wire code (`mail.GMAIL_SCOPE_MISSING`).
// The catalog is the single source of truth for the code and its human message.
const gmailScopeMissingErrorCode = mailErrors.GMAIL_SCOPE_MISSING.code;

export function isGmailScopeMissingError(errorCode: string) {
  return errorCode === gmailScopeMissingErrorCode;
}

// Object.values also surfaces the catalog's typed `_prefix`/`_codes` members;
// skip them and keep only the error factories.
const mailErrorMessagesByCode = new Map<string, string>();

for (const catalogError of Object.values(mailErrors)) {
  if (typeof catalogError !== "function") {
    continue;
  }

  mailErrorMessagesByCode.set(catalogError.code, catalogError.message);
}

const fallbackErrorMessage = "Something went wrong. Please try again.";

// Write-through mail mutations report whether the local cache was
// updated alongside Gmail. `cacheApplied: false` means Gmail accepted the
// change but the cache write failed after internal retries — the next
// history sync heals it, but until then a refetch can serve the stale rows.
type CacheWriteResult =
  | { readonly data: { readonly cacheApplied?: boolean }; readonly status: "ok" }
  | { readonly error: string; readonly status: "error" };

const cacheDeferredWarningMessage =
  "Saved to Gmail, but this change may briefly reappear until your mailbox finishes syncing.";

// An optimistic update must never silently revert: when the cache write was
// skipped, surface this warning as a toast next to the successful mutation.
export function getCacheWriteWarning(
  result: CacheWriteResult,
  options: { readonly suppress?: boolean } = {},
) {
  if (!options.suppress && result.status === "ok" && result.data.cacheApplied === false) {
    return cacheDeferredWarningMessage;
  }

  return null;
}

export function shouldInvalidateAfterCacheWrite(result: CacheWriteResult | undefined) {
  return result?.status === "ok" && result.data.cacheApplied !== false;
}

// Draft create/update have no optimistic cache patch to preserve. Gmail is
// authoritative, so refresh their lists after every accepted write even when
// the direct cache write was deferred to history sync.
export function shouldRefreshDraftQueriesAfterMutation(result: CacheWriteResult | undefined) {
  return result?.status === "ok";
}

// Scope-missing means the user granted the legacy readonly+send scopes and has
// to re-consent before any write action works — surface a reconnect prompt
// instead of a plain error toast.
export function getMutationErrorPresentation(errorCode: string) {
  if (isGmailScopeMissingError(errorCode)) {
    return {
      kind: "reconnect" as const,
      message: "Gmail needs updated permissions",
      title: "Gmail needs reconnect",
    };
  }

  return {
    kind: "generic" as const,
    message: mailErrorMessagesByCode.get(errorCode) ?? fallbackErrorMessage,
    title: "Mailbox temporarily unavailable",
  };
}
