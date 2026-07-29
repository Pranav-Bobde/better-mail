type DeleteAccountError = {
  readonly code?: string | null | undefined;
  readonly message?: string | null | undefined;
};

// Better Auth deletes without a password only while the session is fresh;
// stale sessions reject with SESSION_EXPIRED and need a re-sign-in first.
export function getDeleteAccountErrorMessage(error: DeleteAccountError | null) {
  if (isStaleSessionError(error)) {
    return "For security, sign out and back in, then retry deleting your account.";
  }

  return "Account deletion failed. Try again.";
}

function isStaleSessionError(error: DeleteAccountError | null) {
  if (!error) {
    return false;
  }

  if (error.code === "SESSION_EXPIRED") {
    return true;
  }

  return typeof error.message === "string" && error.message.includes("Session expired");
}

export function getDeleteAccountLabel(isConfirming: boolean) {
  return isConfirming ? "Confirm delete account" : "Delete account";
}
