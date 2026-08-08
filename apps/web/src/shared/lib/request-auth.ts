import { timingSafeEqual } from "node:crypto";

type RouteHandler = (request: Request) => Response | Promise<Response>;
type SessionLookup = (headers: Headers) => Promise<unknown | null>;

export function hasBearerSecret(headers: Headers, expectedSecret: string | undefined) {
  if (!expectedSecret) {
    return false;
  }

  const token = getBearerToken(headers);

  if (!token) {
    return false;
  }

  return secretsMatch(token, expectedSecret);
}

export function getBearerToken(headers: Headers) {
  const authorization = headers.get("authorization");
  const match = authorization?.match(/^Bearer ([^\s]+)$/);

  return match?.[1];
}

export function withBearerSecretAuth(handler: RouteHandler, getSecret: () => string | undefined) {
  return async (request: Request) => {
    if (!hasBearerSecret(request.headers, getSecret())) {
      return new Response("Unauthorized", { status: 401 });
    }

    return handler(request);
  };
}

export function withSessionAuth(handler: RouteHandler, getSession: SessionLookup) {
  return async (request: Request) => {
    const session = await getSession(request.headers);

    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }

    return handler(request);
  };
}

function secretsMatch(actualSecret: string | null, expectedSecret: string) {
  if (!actualSecret) {
    return false;
  }

  const actual = Buffer.from(actualSecret);
  const expected = Buffer.from(expectedSecret);

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
