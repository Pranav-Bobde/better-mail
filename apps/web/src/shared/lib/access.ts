import { isOwnerOnlyPrelaunchAuthUrl } from "@code-main/auth/prelaunch-access";

/*
 * Pre-launch access gate.
 *
 * While the product is waitlist-only, the landing page carries no sign-in
 * surface and `/login` bounces back to `/`. Exceptions are the stable staging
 * and production origins, where the auth layer independently
 * restricts Google OAuth and app sessions to the verified owner account.
 */
const SIGN_IN_ENABLED = false;

export function isSignInPageEnabled(authUrl: string) {
  return SIGN_IN_ENABLED || isOwnerOnlyPrelaunchAuthUrl(authUrl);
}
