import assert from "node:assert/strict";
import test from "node:test";

import { createAiSearchQuery } from "@/features/mail/components/mail-ai-tools";
import { isEmptyDemoSearchQuery, parseDemoSearchQuery } from "@/features/mail/demo/demo-search";
import {
  createDemoMailboxState,
  selectDemoMailboxData,
} from "@/features/mail/demo/demo-mailbox-state";

function searchInboxThreadIds(query: string) {
  return selectDemoMailboxData(createDemoMailboxState(), {
    folder: "inbox",
    query,
    view: "all",
  }).messages.map((message) => message.threadId);
}

test("an empty query parses to an empty filter", () => {
  const parsed = parseDemoSearchQuery("   ");

  assert.equal(isEmptyDemoSearchQuery(parsed), true);
  assert.deepEqual(parsed.terms, []);
});

test("bare words parse as lowercase search terms", () => {
  const parsed = parseDemoSearchQuery("Roadmap Status");

  assert.deepEqual(parsed.terms, ["roadmap", "status"]);
  assert.equal(isEmptyDemoSearchQuery(parsed), false);
});

test("the assistant sender filter parses as a sender, quoted or not", () => {
  assert.deepEqual(
    parseDemoSearchQuery(createAiSearchQuery({ sender: "priya.raman@lumenlabs.io" })).senders,
    ["priya.raman@lumenlabs.io"],
  );
  assert.deepEqual(parseDemoSearchQuery(createAiSearchQuery({ sender: "Sofia Alvarez" })).senders, [
    "sofia alvarez",
  ]);
});

test("read-state, absolute-date and relative-date operators parse", () => {
  assert.equal(parseDemoSearchQuery("is:unread").read, false);
  assert.equal(parseDemoSearchQuery("is:read").read, true);
  assert.equal(parseDemoSearchQuery("after:2026/08/07").after, Date.parse("2026-08-07"));
  assert.equal(parseDemoSearchQuery("before:2026/08/01").before, Date.parse("2026-08-01"));
  assert.equal(parseDemoSearchQuery("newer_than:7d").newerThanDays, 7);
  assert.equal(parseDemoSearchQuery("older_than:10d").olderThanDays, 10);
});

test("unknown operators are dropped instead of being searched for", () => {
  const parsed = parseDemoSearchQuery("has:attachment label:whatever onboarding");

  assert.deepEqual(parsed.terms, ["onboarding"]);
  assert.deepEqual(parsed.senders, []);
});

test("a bare term matches sender, subject and body text", () => {
  assert.deepEqual(searchInboxThreadIds("roadmap"), ["demo-thread-002", "demo-thread-003"]);
  assert.deepEqual(searchInboxThreadIds("Caldera"), ["demo-thread-011"]);
});

test("from: matches an address and a quoted display name", () => {
  assert.deepEqual(searchInboxThreadIds("from:priya.raman@lumenlabs.io"), ["demo-thread-002"]);
  assert.deepEqual(searchInboxThreadIds('from:"Sofia Alvarez"'), ["demo-thread-006"]);
});

test("is:unread narrows the folder to unread threads", () => {
  assert.deepEqual(searchInboxThreadIds("is:unread").length, 9);
  assert.deepEqual(searchInboxThreadIds("is:read").length, 8);
});

test("after: and before: bound the folder by message date", () => {
  assert.deepEqual(searchInboxThreadIds("after:2026/08/07"), [
    "demo-thread-014",
    "demo-thread-002",
    "demo-thread-003",
    "demo-thread-004",
    "demo-thread-006",
    "demo-thread-015",
  ]);
  assert.deepEqual(searchInboxThreadIds("before:2026/08/01"), [
    "demo-thread-013",
    "demo-thread-008",
  ]);
});

test("an assistant query combining sender, date range and keywords matches one thread", () => {
  const query = createAiSearchQuery({
    dateRange: "last7Days",
    query: "onboarding",
    sender: "Marcus Chen",
  });

  assert.equal(query, 'from:"Marcus Chen" newer_than:7d onboarding');
  assert.deepEqual(searchInboxThreadIds(query), ["demo-thread-001"]);
});

test("a query that matches nothing returns no rows rather than throwing", () => {
  assert.deepEqual(searchInboxThreadIds("from:nobody@example.com quarterly"), []);
});
