import assert from "node:assert/strict";
import test from "node:test";

import {
  createAiSearchQuery,
  createForwardBody,
  draftEmailParameters,
  filterEmailParameters,
  forwardEmailParameters,
  getClientMailSearchQuery,
  getForwardSubject,
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

test("forward subject adds a Fwd prefix only when missing", () => {
  assert.equal(getForwardSubject("Project kickoff"), "Fwd: Project kickoff");
  assert.equal(getForwardSubject("Fwd: Project kickoff"), "Fwd: Project kickoff");
  assert.equal(getForwardSubject("fwd: already"), "fwd: already");
});

test("forward body quotes the original message with a forwarded header", () => {
  const body = createForwardBody({
    date: "2026-06-13T10:45:30.000Z",
    email: "sarah@example.com",
    name: "Sarah Rao",
    subject: "Project kickoff",
    text: "Let's kick off on Monday.",
  });

  assert.match(body, /^---------- Forwarded message ---------/);
  assert.match(body, /From: Sarah Rao <sarah@example.com>/);
  assert.match(body, /Subject: Project kickoff/);
  assert.match(body, /Let's kick off on Monday\.$/);
});

test("forward body prepends an optional note above the quoted message", () => {
  const body = createForwardBody(
    {
      date: "2026-06-13T10:45:30.000Z",
      email: "sarah@example.com",
      name: "Sarah Rao",
      subject: "Project kickoff",
      text: "Let's kick off on Monday.",
    },
    "FYI — see below.",
  );

  assert.match(body, /^FYI — see below\.\n\n---------- Forwarded message ---------/);
});

test("forward tool requires a valid recipient email", () => {
  assert.equal(forwardEmailParameters.safeParse({ to: "not-an-email" }).success, false);
  assert.equal(
    forwardEmailParameters.safeParse({ to: "john@example.com", note: "FYI" }).success,
    true,
  );
});
