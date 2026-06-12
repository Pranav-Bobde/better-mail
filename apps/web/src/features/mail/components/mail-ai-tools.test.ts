import assert from "node:assert/strict";
import test from "node:test";

import {
  createAiSearchQuery,
  draftEmailParameters,
  filterEmailParameters,
  getClientMailSearchQuery,
} from "@/features/mail/components/mail-ai-tools";

test("draft tool accepts real-shaped assistant draft values", () => {
  const result = draftEmailParameters.safeParse({
    to: "rohan@example.com",
    subject: "Weekend update",
    body: "I am not going to make it this weekend.",
    responseText: "I drafted this email below.",
  });

  assert.equal(result.success, true);
});

test("draft tool rejects incomplete visible compose values", () => {
  const result = draftEmailParameters.safeParse({
    to: "",
    subject: "Weekend update",
    body: "I am not going to make it this weekend.",
  });

  assert.equal(result.success, false);
  assert.equal(result.error?.issues[0]?.path.join("."), "to");
});

test("filter tool maps assistant filters to a Gmail search query", () => {
  const parsed = filterEmailParameters.parse({
    dateRange: "last10Days",
    query: "project update",
    sender: "sarah@example.com",
    view: "unread",
  });

  assert.equal(createAiSearchQuery(parsed), "from:sarah@example.com newer_than:10d project update");
});

test("client search skips Gmail queries that were already handled by Gmail", () => {
  assert.equal(getClientMailSearchQuery("from:sarah@example.com newer_than:10d", true), "");
});

test("client search still filters plain text when Gmail data is unavailable", () => {
  assert.equal(getClientMailSearchQuery("weekend update", false), "weekend update");
});

test("client search skips Gmail syntax when only mock data is available", () => {
  assert.equal(getClientMailSearchQuery('from:"Sarah Rao" newer_than:10d', false), "");
});
