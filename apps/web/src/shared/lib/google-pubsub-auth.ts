import { OAuth2Client } from "google-auth-library";

import { getBearerToken } from "@/shared/lib/request-auth";

type GooglePubSubClaims = {
  readonly email?: string;
  readonly email_verified?: boolean;
};

type GoogleIdTokenVerifier = (
  idToken: string,
  audience: string,
) => Promise<GooglePubSubClaims | undefined>;

type GooglePubSubPushAuthConfig = {
  readonly audience: string;
  readonly serviceAccountEmail: string;
};

const googleAuthClient = new OAuth2Client();

const verifyGoogleIdToken: GoogleIdTokenVerifier = async (idToken, audience) => {
  const ticket = await googleAuthClient.verifyIdToken({
    audience,
    idToken,
  });

  return ticket.getPayload();
};

export async function verifyGooglePubSubPushRequest(
  request: Request,
  config: GooglePubSubPushAuthConfig,
  verifyIdToken: GoogleIdTokenVerifier = verifyGoogleIdToken,
) {
  const idToken = getBearerToken(request.headers);

  if (!idToken) {
    return false;
  }

  const claims = await verifyIdToken(idToken, config.audience).catch(() => undefined);

  return hasExpectedGooglePubSubIdentity(claims, config.serviceAccountEmail);
}

function hasExpectedGooglePubSubIdentity(
  claims: GooglePubSubClaims | undefined,
  serviceAccountEmail: string,
) {
  return claims?.email_verified === true && claims.email === serviceAccountEmail;
}
