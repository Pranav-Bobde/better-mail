/*
 * Pre-launch access gate.
 *
 * While the product is waitlist-only, the landing page carries no sign-in
 * surface and `/login` bounces back to `/`. Flip this to `true` to re-open
 * sign-in; nothing else needs to change on the auth side.
 *
 * Scope: this is a UI gate, not a security boundary. The better-auth
 * endpoints under `/api/auth/*` stay reachable, so a hand-crafted OAuth
 * request can still sign in. That is deliberate — it keeps owner-driven e2e
 * on staging working. Harden at the auth layer if that stops being true.
 */
export const SIGN_IN_ENABLED = false;
