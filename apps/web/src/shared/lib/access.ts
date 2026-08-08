import { isOwnerOnlyStagingAuthUrl } from "@code-main/auth/staging-access";

/*
 * Pre-launch access gate.
 *
 * While the product is waitlist-only, the landing page carries no sign-in
 * surface and `/login` bounces back to `/`. The one exception is the stable
 * staging origin, where the auth layer independently restricts Google OAuth
 * and app sessions to the verified owner account.
 */
const SIGN_IN_ENABLED = false;

export function isSignInPageEnabled(authUrl: string) {
  return SIGN_IN_ENABLED || isOwnerOnlyStagingAuthUrl(authUrl);
}
