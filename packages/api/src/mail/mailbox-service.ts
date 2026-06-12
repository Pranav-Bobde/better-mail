import { env } from "@code-main/env/server";
import { EvlogError } from "evlog";
import { z } from "zod";

import type { MailboxData, MailMessage } from "./contracts";
import { mailErrors } from "./errors";
import {
  getGmailAccessToken,
  getGmailConfig,
  getGmailLabel,
  getGmailMessage,
  getGmailProfile,
  getGmailWatchConfig,
  listGmailLabels,
  listGmailMessages,
  sendGmailMessage,
  startGmailWatch,
} from "./gmail-client";
import type { GmailLabel, GmailMessage, GmailMessagePart } from "./gmail-schemas";
import { gmailPubSubPushSchema, gmailPushDataSchema } from "./gmail-schemas";
import { readGmailDemoState, writeGmailDemoState } from "./gmail-state";

const mailboxMaxResults = 20;

const systemLabelCountIds = {
  drafts: "DRAFT",
  forums: "CATEGORY_FORUMS",
  inbox: "INBOX",
  junk: "SPAM",
  promotions: "CATEGORY_PROMOTIONS",
  sent: "SENT",
  social: "CATEGORY_SOCIAL",
  trash: "TRASH",
  unread: "UNREAD",
  updates: "CATEGORY_UPDATES",
} as const;

const ignoredDisplayLabelIds = new Set([
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
]);

const systemDisplayLabels = {
  IMPORTANT: "important",
  STARRED: "starred",
} as const;

type MailboxErrorOperation = "getMailbox" | "push" | "send" | "startWatch";

const mailboxErrorByOperation = {
  getMailbox: (cause: Error) =>
    mailErrors.GMAIL_LIST_MESSAGES_FAILED({
      cause,
      internal: {
        dependencyOperation: "mailboxService",
      },
    }),
  push: (cause: Error) =>
    mailErrors.GMAIL_PUBSUB_PUSH_INVALID({
      cause,
      internal: {
        dependencyOperation: "pubsub.push",
      },
    }),
  send: (cause: Error) =>
    mailErrors.GMAIL_SEND_MESSAGE_FAILED({
      cause,
      internal: {
        dependencyOperation: "mailboxService",
      },
    }),
  startWatch: (cause: Error) =>
    mailErrors.GMAIL_WATCH_FAILED({
      cause,
      internal: {
        dependencyOperation: "mailboxService",
      },
    }),
} satisfies Record<MailboxErrorOperation, (cause: Error) => EvlogError>;

export async function getMailboxData(input: {
  readonly query: string;
  readonly view: "all" | "unread";
}) {
  const config = getGmailConfig();

  return getConfiguredMailboxData(input, config);
}

async function getConfiguredMailboxData(
  input: { readonly query: string; readonly view: "all" | "unread" },
  config: Extract<ReturnType<typeof getGmailConfig>, { configured: true }>,
) {
  const accessToken = await getGmailAccessToken(config);
  const mailboxBaseData = await getMailboxBaseData(input, config, accessToken);
  const messageDetails = await getMailboxMessageDetails(
    accessToken,
    config.userId,
    mailboxBaseData.listResponse.messages ?? [],
  );

  return createMailboxSuccessData(mailboxBaseData, messageDetails);
}

async function getMailboxBaseData(
  input: { readonly query: string; readonly view: "all" | "unread" },
  config: Extract<ReturnType<typeof getGmailConfig>, { configured: true }>,
  accessToken: string,
) {
  const [profile, gmailLabels, mailboxState, listResponse, counts] = await Promise.all([
    getGmailProfile(accessToken, config.userId),
    listGmailLabels(accessToken, config.userId),
    readGmailDemoState(),
    listGmailMessages({
      accessToken,
      labelIds: getListLabelIds(input.view),
      maxResults: mailboxMaxResults,
      query: getMailboxQuery(input),
      userId: config.userId,
    }),
    getMailboxCounts(accessToken, config.userId),
  ]);

  return {
    counts,
    gmailLabels,
    listResponse,
    mailboxState,
    profile,
  };
}

async function getMailboxMessageDetails(
  accessToken: string,
  userId: string,
  messages: readonly { readonly id: string }[],
) {
  return Promise.all(messages.map((message) => getGmailMessage(accessToken, userId, message.id)));
}

function createMailboxSuccessData(
  mailboxBaseData: Awaited<ReturnType<typeof getMailboxBaseData>>,
  messageDetails: readonly GmailMessage[],
) {
  const labelById = new Map(mailboxBaseData.gmailLabels.map((label) => [label.id, label]));

  return {
    data: {
      account: {
        email: mailboxBaseData.profile.emailAddress,
        label: getMailboxLabel(mailboxBaseData.profile.emailAddress),
      },
      counts: mailboxBaseData.counts,
      lastHistoryId: mailboxBaseData.mailboxState?.historyId ?? mailboxBaseData.profile.historyId,
      messages: messageDetails.map((message) => toMailMessage(message, labelById)),
      source: "gmail" as const,
      watchExpiration: mailboxBaseData.mailboxState?.watchExpiration,
    } satisfies MailboxData,
    status: "ok" as const,
  };
}

export async function sendMailboxMessage(input: {
  readonly body: string;
  readonly inReplyTo?: string;
  readonly subject: string;
  readonly threadId?: string;
  readonly to: string;
}) {
  const config = getGmailConfig();

  const accessToken = await getGmailAccessToken(config);
  const sentMessage = await sendGmailMessage({
    accessToken,
    raw: createRawMimeMessage(input),
    threadId: input.threadId,
    userId: config.userId,
  });

  return {
    data: {
      messageId: sentMessage.id,
      threadId: sentMessage.threadId,
    },
    status: "ok" as const,
  };
}

export async function startMailboxWatch() {
  const config = getGmailWatchConfig();

  const accessToken = await getGmailAccessToken(config);
  const profile = await getGmailProfile(accessToken, config.userId);
  const watch = await startGmailWatch({
    accessToken,
    labelIds: config.labelIds,
    topicName: config.topicName,
    userId: config.userId,
  });

  await writeGmailDemoState({
    emailAddress: profile.emailAddress,
    historyId: watch.historyId,
    watchExpiration: watch.expiration,
  });

  return {
    data: {
      expiration: watch.expiration,
      historyId: watch.historyId,
      labelIds: config.labelIds,
    },
    status: "ok" as const,
  };
}

export async function handleGmailPushPayload(input: unknown, endpointToken: string | null) {
  if (!isValidPushToken(endpointToken)) {
    throw mailErrors.GMAIL_PUBSUB_PUSH_INVALID({
      cause: new Error("Invalid Gmail Pub/Sub verification token"),
      internal: {
        handler: "mailboxService.handleGmailPushPayload",
      },
    });
  }

  const parsedPush = gmailPubSubPushSchema.safeParse(input);
  if (!parsedPush.success) {
    throw mailErrors.GMAIL_PUBSUB_PUSH_INVALID({
      cause: new Error(z.prettifyError(parsedPush.error)),
    });
  }

  const decodedData = decodeGmailPushData(
    parsedPush.data.message.data,
    parsedPush.data.message.messageId,
  );
  const parsedData = gmailPushDataSchema.safeParse(decodedData);
  if (!parsedData.success) {
    throw mailErrors.GMAIL_PUBSUB_PUSH_INVALID({
      cause: new Error(z.prettifyError(parsedData.error)),
      internal: {
        ...getGmailPushDataDiagnostics(decodedData),
        messageId: parsedPush.data.message.messageId,
      },
    });
  }

  await writeGmailDemoState({
    emailAddress: parsedData.data.emailAddress,
    historyId: parsedData.data.historyId,
  });

  return {
    data: parsedData.data,
    status: "ok" as const,
  };
}

export function logMailboxError(
  log: { readonly error: (error: EvlogError) => void } | undefined,
  error: unknown,
  operation: MailboxErrorOperation,
) {
  const evlogError = getMailboxEvlogError(error, operation);

  log?.error(evlogError);

  return evlogError;
}

function getMailboxCounts(accessToken: string, userId: string) {
  return Promise.all([
    getSystemLabelCounts(accessToken, userId),
    getMessageCountByQuery(accessToken, userId, "-in:inbox -in:sent -in:drafts -in:trash -in:spam"),
    getMessageCountByQuery(
      accessToken,
      userId,
      "category:promotions (receipt OR order OR purchase)",
    ),
  ]).then(([systemCounts, archive, shopping]) => ({
    ...systemCounts,
    archive,
    shopping,
  }));
}

async function getSystemLabelCounts(accessToken: string, userId: string) {
  const labels = await Promise.all(
    Object.entries(systemLabelCountIds).map(async ([key, labelId]) => ({
      key,
      label: await getGmailLabel(accessToken, userId, labelId),
    })),
  );

  return labels.reduce(
    (counts, item) => ({
      ...counts,
      [item.key]: getMessageTotal(item.label),
    }),
    {
      drafts: 0,
      forums: 0,
      inbox: 0,
      junk: 0,
      promotions: 0,
      sent: 0,
      social: 0,
      trash: 0,
      unread: 0,
      updates: 0,
    },
  );
}

async function getMessageCountByQuery(accessToken: string, userId: string, query: string) {
  const response = await listGmailMessages({
    accessToken,
    maxResults: 1,
    query,
    userId,
  });

  return response.resultSizeEstimate ?? 0;
}

function toMailMessage(message: GmailMessage, labelById: ReadonlyMap<string, GmailLabel>) {
  const headers = message.payload?.headers ?? [];
  const from = parseEmailAddress(getHeaderValue(headers, "From"));
  const labelIds = message.labelIds ?? [];

  return {
    date: getMessageDate(message, headers),
    email: from.email,
    id: message.id,
    labels: getDisplayLabels(labelIds, labelById),
    name: from.name,
    read: !labelIds.includes("UNREAD"),
    subject: getMessageSubject(headers),
    text: getDisplayText(message),
    threadId: message.threadId,
  } satisfies MailMessage;
}

function getListLabelIds(view: "all" | "unread") {
  switch (view) {
    case "all":
      return ["INBOX"];
    case "unread":
      return ["INBOX", "UNREAD"];
    default:
      return view satisfies never;
  }
}

function getMailboxQuery(input: { readonly query: string; readonly view: "all" | "unread" }) {
  const parts = [input.query.trim()];

  if (input.view === "unread") {
    parts.push("is:unread");
  }

  return parts.filter((part) => part.length > 0).join(" ") || undefined;
}

function getMessageText(part: GmailMessagePart | undefined): string {
  if (!part) {
    return "";
  }

  return getPlainTextFromPart(part) || getHtmlTextFromPart(part);
}

function getPlainTextFromPart(part: GmailMessagePart) {
  return getDirectPlainText(part) || getNestedPlainText(part);
}

function getDirectPlainText(part: GmailMessagePart) {
  return part.mimeType === "text/plain" ? decodePartBody(part) : "";
}

function getNestedPlainText(part: GmailMessagePart) {
  const parts = getNestedParts(part);
  return decodePartBody(
    findPartWithBody([...parts, ...parts.flatMap((item) => item.parts ?? [])], "text/plain"),
  );
}

function getNestedParts(part: GmailMessagePart) {
  return part.parts ?? [];
}

function getHtmlTextFromPart(part: GmailMessagePart) {
  const htmlPart = findPartWithBody(part.parts ?? [], "text/html");

  return htmlPart ? stripHtml(decodePartBody(htmlPart)) : "";
}

function findPartWithBody(parts: readonly GmailMessagePart[], mimeType: string) {
  return parts.find((item) => item.mimeType === mimeType && item.body?.data);
}

function decodePartBody(part: GmailMessagePart | undefined) {
  return part?.body?.data ? decodeGmailBody(part.body.data) : "";
}

function getDisplayLabels(labelIds: readonly string[], labelById: ReadonlyMap<string, GmailLabel>) {
  return labelIds
    .flatMap((labelId) => getDisplayLabel(labelId, labelById))
    .filter((label, index, labels) => labels.indexOf(label) === index)
    .slice(0, 3);
}

function getDisplayLabel(labelId: string, labelById: ReadonlyMap<string, GmailLabel>) {
  if (ignoredDisplayLabelIds.has(labelId)) {
    return [];
  }

  const displayLabel = getSystemDisplayLabel(labelId) ?? getUserDisplayLabel(labelId, labelById);

  return displayLabel ? [displayLabel] : [];
}

function getUserDisplayLabel(labelId: string, labelById: ReadonlyMap<string, GmailLabel>) {
  const userLabel = labelById.get(labelId);
  return userLabel?.type === "user" ? userLabel.name.toLowerCase() : null;
}

function getHeaderValue(
  headers: readonly { readonly name: string; readonly value: string }[],
  name: string,
) {
  return headers.find((header) => header.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function parseEmailAddress(value: string) {
  const match = value.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>/);
  const displayName = match?.[1]?.trim();
  const email = match?.[2]?.trim() || value.trim();

  return {
    email,
    name: displayName || email || "Unknown sender",
  };
}

function getMessageDate(
  message: GmailMessage,
  headers: readonly { readonly name: string; readonly value: string }[],
) {
  if (message.internalDate) {
    return new Date(Number(message.internalDate)).toISOString();
  }

  const dateHeader = getHeaderValue(headers, "Date");
  const parsedDate = Date.parse(dateHeader);

  if (Number.isNaN(parsedDate)) {
    return new Date().toISOString();
  }

  return new Date(parsedDate).toISOString();
}

function getDisplayText(message: GmailMessage) {
  return getMessageText(message.payload) || message.snippet || "";
}

function getMessageSubject(headers: readonly { readonly name: string; readonly value: string }[]) {
  return getHeaderValue(headers, "Subject") || "(No subject)";
}

function createRawMimeMessage(input: {
  readonly body: string;
  readonly inReplyTo?: string;
  readonly subject: string;
  readonly to: string;
}) {
  const headers = [
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    "Content-Type: text/plain; charset=UTF-8",
    "MIME-Version: 1.0",
  ];

  if (input.inReplyTo) {
    headers.push(`In-Reply-To: ${input.inReplyTo}`, `References: ${input.inReplyTo}`);
  }

  return Buffer.from(`${headers.join("\r\n")}\r\n\r\n${input.body}`).toString("base64url");
}

function decodeGmailBody(data: string) {
  return Buffer.from(data, "base64url").toString("utf8");
}

function stripHtml(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function getMessageTotal(label: GmailLabel) {
  return label.messagesTotal ?? 0;
}

function getSystemDisplayLabel(labelId: string) {
  switch (labelId) {
    case "IMPORTANT":
      return systemDisplayLabels.IMPORTANT;
    case "STARRED":
      return systemDisplayLabels.STARRED;
    default:
      return null;
  }
}

function getMailboxLabel(email: string) {
  return email.split("@")[0] ?? email;
}

function isValidPushToken(endpointToken: string | null) {
  return endpointToken !== null && endpointToken === env.GMAIL_PUBSUB_VERIFICATION_TOKEN;
}

function decodeGmailPushData(data: string, messageId: string | undefined) {
  try {
    return JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
  } catch (error) {
    throw mailErrors.GMAIL_PUBSUB_PUSH_INVALID({
      cause: getErrorCause(error),
      internal: {
        messageId,
      },
    });
  }
}

function getGmailPushDataDiagnostics(data: unknown) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {
      decodedKeys: [],
      decodedType: getDiagnosticType(data),
      emailAddressPresent: false,
      historyIdType: "missing",
    };
  }

  const decodedRecord = data as Record<string, unknown>;

  return {
    decodedKeys: Object.keys(decodedRecord).sort().slice(0, 10),
    decodedType: "object",
    emailAddressPresent: typeof decodedRecord.emailAddress === "string",
    historyIdType: getDiagnosticType(decodedRecord.historyId),
  };
}

function getDiagnosticType(value: unknown) {
  if (value === null) {
    return "null";
  }

  if (Array.isArray(value)) {
    return "array";
  }

  return typeof value;
}

function getMailboxEvlogError(error: unknown, operation: MailboxErrorOperation) {
  if (error instanceof EvlogError) {
    return error;
  }

  return mailboxErrorByOperation[operation](getErrorCause(error));
}

function getErrorCause(error: unknown) {
  if (error instanceof Error) {
    return error;
  }

  return new Error("Unknown mailbox failure");
}
