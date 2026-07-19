import assert from "node:assert/strict";
import { test } from "node:test";

import { formatMailBadgeCount, getDisplayLabels } from "./label-presentation";

type GmailLabelFixture = {
  readonly id: string;
  readonly labelListVisibility: string;
  readonly messageListVisibility: string;
  readonly name: string;
  readonly type: "system" | "user";
};

function createGmailLabelFixture(id: string, name: string, type: "system" | "user") {
  return {
    id,
    labelListVisibility: "labelShow",
    messageListVisibility: "show",
    name,
    type,
  } satisfies GmailLabelFixture;
}

const ignoredSystemLabels = [
  "CATEGORY_FORUMS",
  "CATEGORY_PERSONAL",
  "CATEGORY_PROMOTIONS",
  "CATEGORY_SOCIAL",
  "CATEGORY_UPDATES",
  "DRAFT",
  "INBOX",
  "SENT",
  "SPAM",
  "TRASH",
  "UNREAD",
].map((id) => createGmailLabelFixture(id, id, "system"));

test("maps important and starred system labels before dropping ignored system labels", () => {
  assert.deepEqual(
    getDisplayLabels([
      createGmailLabelFixture("IMPORTANT", "IMPORTANT", "system"),
      createGmailLabelFixture("STARRED", "STARRED", "system"),
      createGmailLabelFixture("INBOX", "INBOX", "system"),
    ]),
    ["important", "starred"],
  );
});

test("drops all ignored system labels", () => {
  assert.deepEqual(getDisplayLabels(ignoredSystemLabels), []);
});

test("drops system labels outside the ignore set, like CHAT", () => {
  assert.deepEqual(getDisplayLabels([createGmailLabelFixture("CHAT", "CHAT", "system")]), []);
});

test("lowercases user label names", () => {
  assert.deepEqual(
    getDisplayLabels([createGmailLabelFixture("Label_Important", "Important", "user")]),
    ["important"],
  );
});

test("preserves mixed input order and returns the first three unique display labels", () => {
  assert.deepEqual(
    getDisplayLabels([
      createGmailLabelFixture("INBOX", "INBOX", "system"),
      createGmailLabelFixture("STARRED", "STARRED", "system"),
      createGmailLabelFixture("Label_Important", "Important", "user"),
      createGmailLabelFixture("IMPORTANT", "IMPORTANT", "system"),
      createGmailLabelFixture("DRAFT", "DRAFT", "system"),
    ]),
    ["starred", "important"],
  );
});

test("formats mail badge counts", () => {
  assert.equal(formatMailBadgeCount(0), null);
  assert.equal(formatMailBadgeCount(-1), null);
  assert.equal(formatMailBadgeCount(1), "1");
  assert.equal(formatMailBadgeCount(99), "99");
  assert.equal(formatMailBadgeCount(100, { cap: 99 }), "99+");
  assert.equal(formatMailBadgeCount(100), "100");
});
