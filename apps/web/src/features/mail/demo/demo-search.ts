import type { DemoMessage } from "@/features/mail/demo/demo-data";

// A token is an operator with a quoted value (from:"Sofia Alvarez"), a bare
// quoted phrase, or a run of non-space characters — in that order, so the
// quoted value of an operator is not split at its spaces.
const tokenPattern = /[a-z_]+:"[^"]*"|"[^"]*"|\S+/gi;
const operatorPattern = /^([a-z_]+):(.*)$/i;
const relativeDayPattern = /^(\d+)d$/i;
const dayInMs = 24 * 60 * 60 * 1000;

type DemoSearchOperatorHandler = (parsed: DemoSearchQuery, value: string) => DemoSearchQuery;

export type DemoSearchQuery = {
  readonly after: number | null;
  readonly before: number | null;
  readonly newerThanDays: number | null;
  readonly olderThanDays: number | null;
  readonly read: boolean | null;
  readonly senders: readonly string[];
  readonly terms: readonly string[];
};

const emptyDemoSearchQuery = {
  after: null,
  before: null,
  newerThanDays: null,
  olderThanDays: null,
  read: null,
  senders: [],
  terms: [],
} satisfies DemoSearchQuery;

// The assistant emits Gmail operator syntax through createAiSearchQuery
// (from:, from:"Two Words", newer_than:7d) while people type bare words, so
// both have to parse here. Operators we do not model are dropped instead of
// being treated as search terms, which is what Gmail does for unknown ones.
export function parseDemoSearchQuery(query: string) {
  const tokens = query.trim().match(tokenPattern) ?? [];

  return tokens.reduce<DemoSearchQuery>(applyDemoSearchToken, emptyDemoSearchQuery);
}

// Every field is either an unset filter (null) or an empty list, so emptiness
// is one rule applied to all of them rather than a condition per field.
export function isEmptyDemoSearchQuery(parsed: DemoSearchQuery) {
  return Object.values(parsed).every(isEmptyDemoSearchValue);
}

function isEmptyDemoSearchValue(value: DemoSearchQuery[keyof DemoSearchQuery]) {
  if (value === null) {
    return true;
  }

  return typeof value === "object" && value.length === 0;
}

// A thread matches when any one of its messages matches every message-level
// condition. Read state is a thread-level property in this mailbox, so it is
// compared against the aggregated thread rather than each message.
export function matchesDemoSearchQuery(input: {
  readonly messages: readonly DemoMessage[];
  readonly parsed: DemoSearchQuery;
  readonly read: boolean;
  readonly referenceTime: number;
}) {
  if (input.parsed.read !== null && input.parsed.read !== input.read) {
    return false;
  }

  return input.messages.some((message) =>
    matchesDemoSearchMessage(message, input.parsed, input.referenceTime),
  );
}

function applyDemoSearchToken(parsed: DemoSearchQuery, token: string) {
  const operator = operatorPattern.exec(token);

  if (operator === null) {
    return addDemoSearchTerm(parsed, unquote(token));
  }

  return applyDemoSearchOperator(
    parsed,
    (operator[1] ?? "").toLowerCase(),
    unquote(operator[2] ?? ""),
  );
}

// Operator → handler. Operators we do not model are simply absent from the
// table, which is what makes them drop out of the query. `subject:` folds into
// a plain term because the term matcher already searches the subject line.
// `to:` is deliberately absent: fixture messages carry no recipient data, and
// matching it against the sender would invert Gmail's semantics.
const demoSearchOperatorHandlers = new Map<string, DemoSearchOperatorHandler>([
  ["after", applyDemoSearchAfter],
  ["before", applyDemoSearchBefore],
  ["from", applyDemoSearchSender],
  ["is", applyDemoSearchReadState],
  ["newer", applyDemoSearchAfter],
  ["newer_than", applyDemoSearchNewerThan],
  ["older", applyDemoSearchBefore],
  ["older_than", applyDemoSearchOlderThan],
  ["subject", addDemoSearchTerm],
]);

function applyDemoSearchOperator(parsed: DemoSearchQuery, operator: string, value: string) {
  const applyOperator = demoSearchOperatorHandlers.get(operator);

  return applyOperator === undefined ? parsed : applyOperator(parsed, value);
}

function applyDemoSearchSender(parsed: DemoSearchQuery, value: string) {
  return value.length === 0
    ? parsed
    : { ...parsed, senders: [...parsed.senders, value.toLowerCase()] };
}

function applyDemoSearchReadState(parsed: DemoSearchQuery, value: string) {
  return { ...parsed, read: parseReadState(value) ?? parsed.read };
}

function applyDemoSearchAfter(parsed: DemoSearchQuery, value: string) {
  return { ...parsed, after: parseSearchDate(value) ?? parsed.after };
}

function applyDemoSearchBefore(parsed: DemoSearchQuery, value: string) {
  return { ...parsed, before: parseSearchDate(value) ?? parsed.before };
}

function applyDemoSearchNewerThan(parsed: DemoSearchQuery, value: string) {
  return { ...parsed, newerThanDays: parseRelativeDays(value) ?? parsed.newerThanDays };
}

function applyDemoSearchOlderThan(parsed: DemoSearchQuery, value: string) {
  return { ...parsed, olderThanDays: parseRelativeDays(value) ?? parsed.olderThanDays };
}

function addDemoSearchTerm(parsed: DemoSearchQuery, term: string) {
  const normalizedTerm = term.toLowerCase();

  return normalizedTerm.length === 0
    ? parsed
    : { ...parsed, terms: [...parsed.terms, normalizedTerm] };
}

function matchesDemoSearchMessage(
  message: DemoMessage,
  parsed: DemoSearchQuery,
  referenceTime: number,
) {
  return (
    matchesDemoSearchSenders(message, parsed.senders) &&
    matchesDemoSearchTerms(message, parsed.terms) &&
    matchesDemoSearchDates(message, parsed, referenceTime)
  );
}

function matchesDemoSearchSenders(message: DemoMessage, senders: readonly string[]) {
  const sender = `${message.name} ${message.email}`.toLowerCase();

  return senders.every((candidate) => sender.includes(candidate));
}

function matchesDemoSearchTerms(message: DemoMessage, terms: readonly string[]) {
  const haystack = [
    message.name,
    message.email,
    message.subject,
    message.text,
    message.snippet ?? "",
  ]
    .join("\n")
    .toLowerCase();

  return terms.every((term) => haystack.includes(term));
}

// newer_than:7d is the same lower bound as after:, just anchored at the
// reference time, so all four date operators collapse into one table of
// "limit + comparison" entries and an unset limit skips its entry.
const demoSearchDateBounds = [
  {
    getLimit: (parsed) => parsed.after,
    isWithin: (messageTime, limit) => messageTime >= limit,
  },
  {
    getLimit: (parsed) => parsed.before,
    isWithin: (messageTime, limit) => messageTime < limit,
  },
  {
    getLimit: (parsed, referenceTime) => toRelativeLimit(parsed.newerThanDays, referenceTime),
    isWithin: (messageTime, limit) => messageTime >= limit,
  },
  {
    getLimit: (parsed, referenceTime) => toRelativeLimit(parsed.olderThanDays, referenceTime),
    isWithin: (messageTime, limit) => messageTime <= limit,
  },
] satisfies readonly {
  readonly getLimit: (parsed: DemoSearchQuery, referenceTime: number) => number | null;
  readonly isWithin: (messageTime: number, limit: number) => boolean;
}[];

function matchesDemoSearchDates(
  message: DemoMessage,
  parsed: DemoSearchQuery,
  referenceTime: number,
) {
  const messageTime = Date.parse(message.date);

  return demoSearchDateBounds.every((bound) => {
    const limit = bound.getLimit(parsed, referenceTime);

    return limit === null || bound.isWithin(messageTime, limit);
  });
}

function toRelativeLimit(days: number | null, referenceTime: number) {
  return days === null ? null : referenceTime - days * dayInMs;
}

function parseReadState(value: string) {
  const normalizedValue = value.toLowerCase();

  if (normalizedValue === "unread") {
    return false;
  }

  return normalizedValue === "read" ? true : null;
}

function parseSearchDate(value: string) {
  const parsed = Date.parse(value.replaceAll("/", "-"));

  return Number.isNaN(parsed) ? null : parsed;
}

function parseRelativeDays(value: string) {
  const days = relativeDayPattern.exec(value);

  if (days === null) {
    return null;
  }

  const parsed = Number(days[1]);

  return Number.isNaN(parsed) ? null : parsed;
}

function unquote(value: string) {
  return value.length >= 2 && value.startsWith('"') && value.endsWith('"')
    ? value.slice(1, -1)
    : value;
}
