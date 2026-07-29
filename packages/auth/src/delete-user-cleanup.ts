import { revokeGoogleToken, type RevokeGoogleTokenResult } from "./google-revoke";

type GetGoogleAccessToken = (userId: string) => Promise<string | null>;

// Better Auth `user.deleteUser` config: before the user row (and, via cascade,
// all synced mail data) is deleted, revoke the app's Google grant.
export function createDeleteUserConfig(getGoogleAccessToken: GetGoogleAccessToken) {
  return {
    enabled: true,
    // Best-effort: a failed revoke must never block account deletion — the
    // user can always revoke the grant from their Google account settings.
    beforeDelete: async (user: { readonly id: string }) => {
      await revokeGoogleGrantBestEffort(getGoogleAccessToken, user.id);
    },
  };
}

export async function revokeGoogleGrantBestEffort(
  getGoogleAccessToken: GetGoogleAccessToken,
  userId: string,
): Promise<RevokeGoogleTokenResult> {
  try {
    return await revokeGoogleGrant(getGoogleAccessToken, userId);
  } catch (error) {
    return { revoked: false, error: getRevokeErrorMessage(error) };
  }
}

async function revokeGoogleGrant(
  getGoogleAccessToken: GetGoogleAccessToken,
  userId: string,
): Promise<RevokeGoogleTokenResult> {
  const accessToken = await getGoogleAccessToken(userId);

  if (accessToken === null || accessToken.length === 0) {
    return { revoked: false, error: "No Google access token available." };
  }

  return revokeGoogleToken(accessToken);
}

function getRevokeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Google token revoke failed unexpectedly.";
}
