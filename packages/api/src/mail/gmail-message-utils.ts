import type { GmailMessage, GmailMessagePart } from "./gmail-schemas";

type GmailHeader = {
  readonly name: string;
  readonly value: string;
};

export function getGmailHeaderValue(headers: readonly GmailHeader[], name: string) {
  return headers.find((header) => header.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

export function getGmailMessageSubject(headers: readonly GmailHeader[]) {
  return getGmailHeaderValue(headers, "Subject") || "(No subject)";
}

export function parseGmailEmailAddress(value: string) {
  const match = value.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>/);
  const displayName = match?.[1]?.trim();
  const email = match?.[2]?.trim() || value.trim();

  return {
    email,
    name: displayName || email || "Unknown sender",
  };
}

export function parseGmailAddressHeader(value: string) {
  return value.trim() ? value.split(",").map((item) => parseGmailEmailAddress(item)) : [];
}

export function getGmailMessageDate(message: GmailMessage) {
  const internalDate = getInternalMessageDate(message);

  return internalDate ?? getHeaderMessageDate(message) ?? new Date();
}

export function getGmailMessageDateIso(message: GmailMessage) {
  return getGmailMessageDate(message).toISOString();
}

export function getGmailMessageText(message: GmailMessage) {
  return (
    getTextFromPart(message.payload, "text/plain") || stripHtml(getGmailMessageHtml(message) ?? "")
  );
}

export function getGmailMessageDisplayText(message: GmailMessage) {
  return getGmailMessageText(message) || message.snippet || "";
}

export function getGmailMessageHtml(message: GmailMessage) {
  return getTextFromPart(message.payload, "text/html") || null;
}

export function getGmailMessageDisplayHtml(message: GmailMessage) {
  return getGmailMessageHtml(message) ?? undefined;
}

function getInternalMessageDate(message: GmailMessage) {
  return message.internalDate ? new Date(Number(message.internalDate)) : null;
}

function getHeaderMessageDate(message: GmailMessage) {
  const parsedDate = Date.parse(getGmailHeaderValue(message.payload?.headers ?? [], "Date"));

  return Number.isNaN(parsedDate) ? null : new Date(parsedDate);
}

function getTextFromPart(part: GmailMessagePart | undefined, mimeType: string): string {
  if (!part) {
    return "";
  }

  return getDirectPartText(part, mimeType) || getNestedPartText(part, mimeType);
}

function getDirectPartText(part: GmailMessagePart, mimeType: string) {
  return part.mimeType === mimeType && part.body?.data ? decodeGmailBody(part.body.data) : "";
}

function getNestedPartText(part: GmailMessagePart, mimeType: string) {
  return (
    (part.parts ?? [])
      .map((nestedPart) => getTextFromPart(nestedPart, mimeType))
      .find((value) => value.length > 0) ?? ""
  );
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
