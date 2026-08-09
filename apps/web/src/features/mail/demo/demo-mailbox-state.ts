import type { MailFolder, MailMessage } from "@code-main/api/mail/contracts";
import { getDisplayLabels } from "@code-main/api/mail/label-presentation";

import type { DemoMessage, DemoProviderLabelId } from "@/features/mail/demo/demo-data";
import { demoAccountEmail, demoLabelById, demoMessages } from "@/features/mail/demo/demo-data";
import {
  isEmptyDemoSearchQuery,
  matchesDemoSearchQuery,
  parseDemoSearchQuery,
} from "@/features/mail/demo/demo-search";

// The real mailbox list caps a folder page at 20 threads; the demo mirrors it
// so pagination behaves the same way once the fixture grows past a page.
const demoMailboxPageSize = 20;
const demoAccountLabel = demoAccountEmail.split("@")[0] ?? demoAccountEmail;

export type DemoDraft = {
  readonly draftId: string;
  readonly messageId: string;
  readonly threadId: string;
};

export type DemoMailboxState = {
  readonly drafts: readonly DemoDraft[];
  readonly messages: readonly DemoMessage[];
  readonly nextSequence: number;
};

export type DemoThread = {
  readonly latestMessage: DemoMessage;
  readonly messages: readonly DemoMessage[];
  readonly read: boolean;
  readonly threadId: string;
};

export function createDemoMailboxState() {
  return {
    drafts: demoMessages
      .filter((message) => message.providerLabels.includes("DRAFT"))
      .map((message, index) => ({
        draftId: `demo-draft-${index + 1}`,
        messageId: message.id,
        threadId: message.threadId,
      })),
    messages: [...demoMessages],
    nextSequence: 1,
  } satisfies DemoMailboxState;
}

function hasDemoProviderLabel(messages: readonly DemoMessage[], labelId: DemoProviderLabelId) {
  return messages.some((message) => message.providerLabels.includes(labelId));
}

function getDemoThreads(state: DemoMailboxState) {
  const messagesByThreadId = new Map<string, DemoMessage[]>();

  for (const message of state.messages) {
    const threadMessages = messagesByThreadId.get(message.threadId) ?? [];
    threadMessages.push(message);
    messagesByThreadId.set(message.threadId, threadMessages);
  }

  return [...messagesByThreadId.values()]
    .flatMap((threadMessages) => toDemoThread(threadMessages) ?? [])
    .sort(
      (left, right) => Date.parse(right.latestMessage.date) - Date.parse(left.latestMessage.date),
    );
}

export function getDemoThreadIfExists(state: DemoMailboxState, threadId: string) {
  return getDemoThreads(state).find((thread) => thread.threadId === threadId) ?? null;
}

// Mirrors toMailMessage in mailbox-service: read state and display labels are
// both derived from the provider label ids rather than stored alongside them.
export function toDemoMailMessage(message: DemoMessage) {
  return {
    date: message.date,
    email: message.email,
    html: message.html,
    id: message.id,
    labels: toDemoDisplayLabels(message.providerLabels),
    name: message.name,
    read: !message.providerLabels.includes("UNREAD"),
    snippet: message.snippet,
    subject: message.subject,
    text: message.text,
    threadId: message.threadId,
  } satisfies MailMessage;
}

// Mirrors toMailboxThreadRow: the newest message carries the row, but labels
// and read state are aggregated across the whole thread.
export function toDemoThreadRow(thread: DemoThread) {
  return {
    ...toDemoMailMessage(thread.latestMessage),
    labels: toDemoDisplayLabels(thread.messages.flatMap((message) => message.providerLabels)),
    read: thread.read,
  } satisfies MailMessage;
}

export function selectDemoMailboxData(
  state: DemoMailboxState,
  input: {
    readonly folder: MailFolder;
    readonly query: string;
    readonly view: "all" | "unread";
  },
) {
  return {
    account: {
      email: demoAccountEmail,
      label: demoAccountLabel,
    },
    counts: selectDemoMailboxCounts(state),
    messages: selectDemoThreadRows(state, input),
    source: "gmail" as const,
  };
}

export function selectDemoThreadMessages(state: DemoMailboxState, threadId: string) {
  return getDemoThreadIfExists(state, threadId)?.messages.map(toDemoMailMessage) ?? [];
}

export function selectDemoMailboxCounts(state: DemoMailboxState) {
  return {
    drafts: state.drafts.length,
    inboxUnread: state.messages.filter(
      (message) =>
        message.providerLabels.includes("INBOX") && message.providerLabels.includes("UNREAD"),
    ).length,
  };
}

function selectDemoThreadRows(
  state: DemoMailboxState,
  input: {
    readonly folder: MailFolder;
    readonly query: string;
    readonly view: "all" | "unread";
  },
) {
  const parsed = parseDemoSearchQuery(input.query);
  const referenceTime = getDemoReferenceTime();
  const matchesView = (thread: DemoThread) => input.view === "all" || thread.read === false;
  const matchesSearch = (thread: DemoThread) =>
    isEmptyDemoSearchQuery(parsed) ||
    matchesDemoSearchQuery({
      messages: thread.messages,
      parsed,
      read: thread.read,
      referenceTime,
    });
  const threads = getDemoThreads(state).filter(
    (thread) =>
      matchesDemoFolder(thread, input.folder) && matchesView(thread) && matchesSearch(thread),
  );

  return threads.slice(0, demoMailboxPageSize).map(toDemoThreadRow);
}

// Archive is "everything Gmail did not file anywhere else", so it is the one
// folder defined by the labels a thread must NOT carry.
const archiveExcludedLabelIds = [
  "DRAFT",
  "INBOX",
  "SPAM",
  "TRASH",
] satisfies readonly DemoProviderLabelId[];

// Mirrors cachedFolderThreadWhere in prisma-mail-sync-repository: every folder
// is a predicate over the labels carried by a thread's messages. Keyed by
// folder so the table stays exhaustive without a branch per folder.
const demoFolderPredicates = {
  archive: (thread) =>
    archiveExcludedLabelIds.every((labelId) => !hasDemoProviderLabel(thread.messages, labelId)),
  drafts: threadHasLabel("DRAFT"),
  forums: threadHasLabel("CATEGORY_FORUMS"),
  inbox: threadHasLabel("INBOX"),
  junk: threadHasLabel("SPAM"),
  promotions: threadHasLabel("CATEGORY_PROMOTIONS"),
  sent: threadHasLabel("SENT"),
  social: threadHasLabel("CATEGORY_SOCIAL"),
  trash: threadHasLabel("TRASH"),
  updates: threadHasLabel("CATEGORY_UPDATES"),
} satisfies Record<MailFolder, (thread: DemoThread) => boolean>;

function threadHasLabel(labelId: DemoProviderLabelId) {
  return (thread: DemoThread) => hasDemoProviderLabel(thread.messages, labelId);
}

function matchesDemoFolder(thread: DemoThread, folder: MailFolder) {
  return demoFolderPredicates[folder](thread);
}

// Relative operators such as newer_than:7d anchor to the newest message in the
// fixture rather than the wall clock, so a fixed demo mailbox keeps answering
// "the last seven days" long after the fixture dates were written. This reduces
// over the immutable `demoMessages` fixture, not `state.messages`: a visitor's
// own send/draft is dated with the real wall clock, and letting it become the
// anchor would drift the reference time forward with every mutation, eventually
// aging every fixture message out of "the last seven days".
function getDemoReferenceTime() {
  return demoMessages.reduce(
    (latestTime, message) => Math.max(latestTime, Date.parse(message.date)),
    0,
  );
}

function toDemoThread(threadMessages: readonly DemoMessage[]) {
  const messages = [...threadMessages].sort(
    (left, right) => Date.parse(left.date) - Date.parse(right.date),
  );
  const latestMessage = messages[messages.length - 1];

  if (latestMessage === undefined) {
    return null;
  }

  return {
    latestMessage,
    messages,
    read: messages.every((message) => !message.providerLabels.includes("UNREAD")),
    threadId: latestMessage.threadId,
  } satisfies DemoThread;
}

function toDemoDisplayLabels(providerLabels: readonly DemoProviderLabelId[]) {
  return getDisplayLabels(
    providerLabels.map(
      (labelId) => demoLabelById.get(labelId) ?? { id: labelId, name: labelId, type: "system" },
    ),
  );
}
