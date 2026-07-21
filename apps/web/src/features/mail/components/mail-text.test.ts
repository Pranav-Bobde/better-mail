import assert from "node:assert/strict";
import test from "node:test";

import {
  getBaseSubject,
  getInitials,
  splitQuotedReply,
} from "@/features/mail/components/mail-text";

test("getBaseSubject strips repeated reply prefixes", () => {
  assert.equal(getBaseSubject("Re: Re: Weekly sync"), "Weekly sync");
});

test("getBaseSubject strips mixed reply and forward prefixes in any order", () => {
  assert.equal(getBaseSubject("Fwd: Re: Weekly sync"), "Weekly sync");
});

test("getBaseSubject strips bracketed list tags interleaved with prefixes", () => {
  assert.equal(getBaseSubject("[EXT] RE: FW: Budget"), "Budget");
});

test("getBaseSubject leaves a prefix-free subject untouched", () => {
  assert.equal(getBaseSubject("Meeting Tomorrow"), "Meeting Tomorrow");
});

test("getBaseSubject keeps a prefix when the subject is nothing but prefixes", () => {
  assert.equal(getBaseSubject("Re: Re:"), "Re:");
});

test("getInitials caps multi-word names at the first two initials", () => {
  assert.equal(getInitials("Sarah K f P H"), "SK");
  assert.equal(getInitials("William Smith"), "WS");
});

test("getInitials returns a single letter for one-word names", () => {
  assert.equal(getInitials("William"), "W");
});

test("getInitials returns an empty string for a blank name", () => {
  assert.equal(getInitials("   "), "");
});

test("splitQuotedReply passes through a message with no quote", () => {
  const text = "Hello there\nThanks for the update";
  assert.deepEqual(splitQuotedReply(text), { quoted: null, visible: text });
});

test("splitQuotedReply splits at an On-wrote attribution line", () => {
  const text =
    "Sounds good.\n\nOn Mon, Jan 1, 2024 at 9:00 AM Bob <bob@example.com> wrote:\n> earlier note";
  const { quoted, visible } = splitQuotedReply(text);

  assert.equal(visible, "Sounds good.");
  assert.equal(
    quoted,
    "On Mon, Jan 1, 2024 at 9:00 AM Bob <bob@example.com> wrote:\n> earlier note",
  );
});

test("splitQuotedReply splits at the first quoted (>) line", () => {
  const text = "Yes, agreed\n> old line\n> more history";
  assert.deepEqual(splitQuotedReply(text), {
    quoted: "> old line\n> more history",
    visible: "Yes, agreed",
  });
});

test("splitQuotedReply does not collapse a message that is entirely quoted", () => {
  const text = "> everything here\n> is quoted";
  assert.deepEqual(splitQuotedReply(text), { quoted: null, visible: text });
});
