export const stagingOwnerEmail = "nearl0407@gmail.com";
export const ownerOnlyStagingOrigin =
  "https://better-mail-git-staging-pranavbobdes-projects.vercel.app";

export function isOwnerOnlyStagingAuthUrl(authUrl: string) {
  try {
    return new URL(authUrl).origin === ownerOnlyStagingOrigin;
  } catch {
    return false;
  }
}

export function mapGoogleProfileForAuthAccess(
  authUrl: string,
  profile: { readonly email: string; readonly email_verified: boolean },
) {
  if (!isOwnerOnlyStagingAuthUrl(authUrl)) {
    return {};
  }

  return profile.email_verified && isStagingOwnerEmail(profile.email) ? {} : { email: null };
}

export function filterSessionForAuthAccess<
  Session extends { readonly user: { readonly email: string } },
>(authUrl: string, session: Session | null) {
  if (
    session !== null &&
    isOwnerOnlyStagingAuthUrl(authUrl) &&
    !isStagingOwnerEmail(session.user.email)
  ) {
    return null;
  }

  return session;
}

function isStagingOwnerEmail(email: string) {
  return email.trim().toLowerCase() === stagingOwnerEmail;
}
