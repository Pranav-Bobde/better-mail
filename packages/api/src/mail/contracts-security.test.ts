import { describe, expect, it } from "vitest";

import { createDraftInputSchema, sendMailInputSchema, updateDraftInputSchema } from "./contracts";

describe("mail reply header validation", () => {
  it.each([
    [sendMailInputSchema, { body: "hello", subject: "subject", to: "to@example.com" }],
    [createDraftInputSchema, { body: "hello" }],
    [updateDraftInputSchema, { body: "hello", draftId: "draft-1" }],
  ])("rejects CRLF injection", (schema, input) => {
    expect(
      schema.safeParse({
        ...input,
        inReplyTo: "<original@example.com>\r\nBcc: attacker@example.com",
      }).success,
    ).toBe(false);
  });
});
