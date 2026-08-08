import { describe, expect, it } from "vitest";
import { RPCHandler } from "@orpc/server/fetch";
import { os } from "@orpc/server";
import { z } from "zod";

import { rpcErrors } from "./errors";
import { normalizeRpcValidationResponse } from "./request-diagnostics";

const validationRouter = {
  mail: {
    getMailbox: os
      .input(
        z.object({
          folder: z.literal("inbox"),
          query: z.string(),
          view: z.literal("all"),
        }),
      )
      .handler(({ input }) => input),
  },
};

const validationHandler = new RPCHandler(validationRouter);

describe("RPC request diagnostics", () => {
  it("normalizes actual oRPC input validation failure to safe HTTP 200 context", async () => {
    const privateQuery = "from:private-sender@example.com project-codename";
    const request = new Request("http://localhost/api/rpc/mail/getMailbox", {
      body: JSON.stringify({ privateQuery }),
      headers: {
        "content-type": "application/json; charset=utf-8",
        "x-better-mail-client-request-id": "018f47a0-5e4b-7d5a-8f0a-111111111111",
        "x-better-mail-request-trigger": "mailbox.search",
      },
      method: "POST",
    });
    const requestForHandler = request.clone();
    const requestForDiagnostics = request.clone();
    const result = await validationHandler.handle(requestForHandler, {
      context: {},
      prefix: "/api/rpc",
    });

    expect(result.response?.status).toBe(400);
    const normalized = await normalizeRpcValidationResponse(
      requestForDiagnostics,
      result.response!,
    );

    expect(normalized.response.status).toBe(200);
    await expect(normalized.response.clone().json()).resolves.toEqual({
      error: rpcErrors.PROCEDURE_INPUT_INVALID.code,
      status: "error",
    });
    expect(normalized.diagnostics).toEqual({
      bodyBytes: new TextEncoder().encode(JSON.stringify({ privateQuery })).byteLength,
      clientRequestId: "018f47a0-5e4b-7d5a-8f0a-111111111111",
      contentType: "application/json",
      trigger: "mailbox.search",
      validationIssues: [
        {
          code: "invalid_type",
          path: [],
        },
      ],
    });
    expect(JSON.stringify(normalized.diagnostics)).not.toContain(privateQuery);
    expect(JSON.stringify(normalized.diagnostics)).not.toContain("private-sender@example.com");
  });

  it("keeps concurrent invalid requests correlated without leaking or crossing their bodies", async () => {
    const requests = [
      createInvalidRequest("018f47a0-5e4b-7d5a-8f0a-aaaaaaaaaaaa", "mailbox.search", "secret-a"),
      createInvalidRequest("018f47a0-5e4b-7d5a-8f0a-bbbbbbbbbbbb", "mailbox.refresh", "secret-b"),
    ];

    const normalized = await Promise.all(
      requests.map(async (request) => {
        const result = await validationHandler.handle(request.clone(), {
          context: {},
          prefix: "/api/rpc",
        });
        return normalizeRpcValidationResponse(request.clone(), result.response!);
      }),
    );

    expect(normalized.map((entry) => entry.diagnostics?.clientRequestId)).toEqual([
      "018f47a0-5e4b-7d5a-8f0a-aaaaaaaaaaaa",
      "018f47a0-5e4b-7d5a-8f0a-bbbbbbbbbbbb",
    ]);
    expect(normalized.map((entry) => entry.diagnostics?.trigger)).toEqual([
      "mailbox.search",
      "mailbox.refresh",
    ]);
    expect(JSON.stringify(normalized.map((entry) => entry.diagnostics))).not.toContain("secret-");
  });

  it("leaves successful RPC responses unchanged", async () => {
    const response = Response.json({ status: "ok" });
    const normalized = await normalizeRpcValidationResponse(
      new Request("http://localhost/api/rpc/healthCheck", { method: "POST" }),
      response,
    );

    expect(normalized).toEqual({ diagnostics: null, response });
  });

  it("leaves unrelated HTTP 400 responses unchanged", async () => {
    const response = Response.json(
      {
        error: "upstream rejected request",
      },
      { status: 400 },
    );
    const normalized = await normalizeRpcValidationResponse(
      new Request("http://localhost/api/rpc/healthCheck", { method: "POST" }),
      response,
    );

    expect(normalized).toEqual({ diagnostics: null, response });
  });
});

function createInvalidRequest(clientRequestId: string, trigger: string, privateValue: string) {
  return new Request("http://localhost/api/rpc/mail/getMailbox", {
    body: JSON.stringify({ privateValue }),
    headers: {
      "content-type": "application/json",
      "x-better-mail-client-request-id": clientRequestId,
      "x-better-mail-request-trigger": trigger,
    },
    method: "POST",
  });
}
