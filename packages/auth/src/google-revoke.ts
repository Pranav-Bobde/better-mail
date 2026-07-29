const GOOGLE_OAUTH_REVOKE_URL = "https://oauth2.googleapis.com/revoke";

export type RevokeGoogleTokenResult = { revoked: true } | { revoked: false; error: string };

/**
 * Revokes a Google OAuth token (access or refresh) so the app's grant is
 * invalidated on Google's side. Used by account-deletion cleanup.
 */
export async function revokeGoogleToken(token: string): Promise<RevokeGoogleTokenResult> {
  if (token.length === 0) {
    return { revoked: false, error: "Missing Google OAuth token." };
  }

  const response = await fetch(GOOGLE_OAUTH_REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }).toString(),
  });

  if (response.ok) {
    return { revoked: true };
  }

  return { revoked: false, error: await readRevokeErrorDetail(response) };
}

async function readRevokeErrorDetail(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => undefined);
  // Google's revoke error payload shape is { error, error_description }.
  // Object() wraps non-object bodies so the lookup is always safe.
  const errorCode: unknown = Reflect.get(Object(body), "error");
  if (typeof errorCode === "string" && errorCode.length > 0) {
    return errorCode;
  }
  return `Google token revoke failed with status ${response.status}.`;
}
