"use client";

import { toast } from "sonner";

import { authClient } from "@/shared/utils/auth-client";

// One reconnect flow shared by the mailbox error-state button and the
// scope-missing mutation toasts: re-runs Google OAuth so the user can grant
// the gmail.modify scope. Returns false when starting the flow failed (on
// success the browser navigates away, so there is no success return path).
export async function reconnectGoogleAccount() {
  const result = await authClient.signIn.social({
    callbackURL: "/",
    errorCallbackURL: "/",
    provider: "google",
  });

  if (result.error) {
    toast.error(`Error: ${result.error.message ?? "Google reconnect failed."}`);
    return false;
  }

  return true;
}
