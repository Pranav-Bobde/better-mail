type RouteHandler = (request: Request) => Response | Promise<Response>;

export type BodyLimitRejection =
  | { readonly reason: "length-required" }
  | { readonly reason: "too-large"; readonly declaredBytes: number };

// Output spend is capped by the model options; this caps input spend. A JSON
// request without a declared length is rejected rather than buffered, so the
// check stays O(1) — every legitimate JSON client sends content-length.
//
// shared/lib stays dependency-free (no evlog import here, see
// refs/adv_folder_structure.md): callers that want the rejection logged pass
// their own hook rather than this module reaching out to a logger itself.
export function withMaxBodyBytes(
  handler: RouteHandler,
  maxBodyBytes: number,
  options?: { readonly onReject?: (rejection: BodyLimitRejection) => void },
) {
  return async (request: Request) => {
    const verdict = checkBodyLimit(request.headers.get("content-length"), maxBodyBytes);

    if (verdict.withinLimit) {
      return handler(request);
    }

    options?.onReject?.(verdict.rejection);

    if (verdict.rejection.reason === "length-required") {
      return Response.json({ error: "Request must declare a Content-Length." }, { status: 411 });
    }

    return Response.json({ error: "Request body too large." }, { status: 413 });
  };
}

export function isBodyWithinLimit(contentLength: string | null, maxBodyBytes: number) {
  return checkBodyLimit(contentLength, maxBodyBytes).withinLimit;
}

type BodyLimitVerdict =
  | { readonly withinLimit: true }
  | { readonly withinLimit: false; readonly rejection: BodyLimitRejection };

function checkBodyLimit(contentLength: string | null, maxBodyBytes: number): BodyLimitVerdict {
  const declaredBytes = parseContentLengthDigits(contentLength);

  if (declaredBytes === null) {
    return { rejection: { reason: "length-required" }, withinLimit: false };
  }

  return checkDeclaredBytesWithinLimit(declaredBytes, maxBodyBytes);
}

// content-length is DIGIT+ per the HTTP spec; anything else (signs,
// exponents, empty, missing) is malformed and treated as undeclared.
function parseContentLengthDigits(contentLength: string | null): number | null {
  if (contentLength === null || !/^\d+$/.test(contentLength)) {
    return null;
  }

  return Number(contentLength);
}

function checkDeclaredBytesWithinLimit(
  declaredBytes: number,
  maxBodyBytes: number,
): BodyLimitVerdict {
  if (!Number.isSafeInteger(declaredBytes) || declaredBytes > maxBodyBytes) {
    return { rejection: { declaredBytes, reason: "too-large" }, withinLimit: false };
  }

  return { withinLimit: true };
}
