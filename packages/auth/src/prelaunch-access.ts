export const prelaunchOwnerEmail = "nearl0407@gmail.com";
export const ownerOnlyStagingOrigin =
  "https://better-mail-git-staging-pranavbobdes-projects.vercel.app";
export const ownerOnlyProductionOrigin = "https://better-mail-henna.vercel.app";

const ownerOnlyOrigins = new Set([ownerOnlyStagingOrigin, ownerOnlyProductionOrigin]);

export function isOwnerOnlyPrelaunchAuthUrl(authUrl: string) {
  try {
    return ownerOnlyOrigins.has(new URL(authUrl).origin);
  } catch {
    return false;
  }
}

export function mapGoogleProfileForAuthAccess(
  authUrl: string,
  profile: { readonly email: string; readonly email_verified: boolean },
) {
  if (!isOwnerOnlyPrelaunchAuthUrl(authUrl)) {
    return {};
  }

  return profile.email_verified && isPrelaunchOwnerEmail(profile.email) ? {} : { email: null };
}

export function filterSessionForAuthAccess<
  Session extends { readonly user: { readonly email: string } },
>(authUrl: string, session: Session | null) {
  if (
    session !== null &&
    isOwnerOnlyPrelaunchAuthUrl(authUrl) &&
    !isPrelaunchOwnerEmail(session.user.email)
  ) {
    return null;
  }

  return session;
}

function isPrelaunchOwnerEmail(email: string) {
  return email.trim().toLowerCase() === prelaunchOwnerEmail;
}
