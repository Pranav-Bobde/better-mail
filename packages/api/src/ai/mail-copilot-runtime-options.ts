import type { streamText } from "ai";
import {
  convertMessagesToVercelAISDKMessages,
  convertToolsToVercelAITools,
} from "@copilotkit/runtime/v2";

type StreamTextOptions = Parameters<typeof streamText>[0];
type StreamTextTelemetry = StreamTextOptions["experimental_telemetry"];

type RuntimeContextItem = {
  readonly description?: string;
  readonly value?: unknown;
};

export type RuntimeFactoryContext = {
  readonly input: {
    readonly messages: Parameters<typeof convertMessagesToVercelAISDKMessages>[0];
    readonly tools: Parameters<typeof convertToolsToVercelAITools>[0];
    readonly context?: readonly RuntimeContextItem[];
  };
  readonly abortSignal: AbortSignal;
};

type MailAppContext = {
  readonly account?: Record<string, unknown> | null;
  readonly activeDraft?: Record<string, unknown> | null;
  readonly compose?: Record<string, unknown> | null;
  readonly counts?: Record<string, unknown> | null;
  readonly filters?: Record<string, unknown> | null;
  readonly selectedEmail?: Record<string, unknown> | null;
  readonly visibleEmails?: readonly unknown[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseContextValue(value: unknown): unknown {
  return typeof value === "string" ? parseJsonLikeString(value) : value;
}

function parseJsonLikeString(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return value;

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function formatValue(value: unknown): string {
  if (isEmptyValue(value)) return "(empty)";
  if (isPrimitiveValue(value)) return String(value);
  if (Array.isArray(value)) return formatArrayValue(value);

  return formatObjectValue(value);
}

function isEmptyValue(value: unknown) {
  return value === null || value === undefined || value === "";
}

function isPrimitiveValue(value: unknown) {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function formatArrayValue(value: readonly unknown[]) {
  return value.length ? value.map(formatValue).join(", ") : "(empty)";
}

function formatObjectValue(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatEmailAddress(email: Record<string, unknown>) {
  const name = formatValue(email.name);
  const address = formatValue(email.email);

  return address === "(empty)" ? name : `${name} <${address}>`;
}

function formatSelectedEmail(email: unknown) {
  if (!isRecord(email)) return ["### Selected email", "- none"].join("\n");

  return [
    "### Selected email",
    `- id: ${formatValue(email.id)}`,
    `- from: ${formatEmailAddress(email)}`,
    `- subject: ${formatValue(email.subject)}`,
    `- read: ${formatValue(email.read)}`,
    `- labels: ${formatValue(email.labels)}`,
    `- date: ${formatValue(email.date)}`,
    `- threadId: ${formatValue(email.threadId)}`,
    `- body: ${formatValue(email.text)}`,
  ].join("\n");
}

function formatVisibleCompose(compose: unknown) {
  if (!isRecord(compose)) return ["### Visible compose form", "- closed"].join("\n");

  return [
    "### Visible compose form",
    `- open: ${formatValue(compose.open)}`,
    `- to: ${formatValue(compose.to)}`,
    `- subject: ${formatValue(compose.subject)}`,
    `- body: ${formatValue(compose.body)}`,
  ].join("\n");
}

function formatActiveDraft(draft: unknown) {
  if (!isRecord(draft)) return ["### Active draft preview", "- none"].join("\n");

  return [
    "### Active draft preview",
    `- to: ${formatValue(draft.to)}`,
    `- subject: ${formatValue(draft.subject)}`,
    `- body: ${formatValue(draft.body)}`,
  ].join("\n");
}

function formatFilters(filters: unknown) {
  if (!isRecord(filters)) return ["### Active filters", "- none"].join("\n");

  return [
    "### Active filters",
    `- view: ${formatValue(filters.view)}`,
    `- query: ${formatValue(filters.query)}`,
  ].join("\n");
}

function formatAccount(account: unknown, counts: unknown) {
  const accountLines = isRecord(account)
    ? [`- email: ${formatValue(account.email)}`, `- label: ${formatValue(account.label)}`]
    : ["- none"];
  const countLines = isRecord(counts)
    ? [
        `- inbox: ${formatValue(counts.inbox)}`,
        `- unread: ${formatValue(counts.unread)}`,
        `- sent: ${formatValue(counts.sent)}`,
      ]
    : ["- counts: none"];

  return ["### Account", ...accountLines, ...countLines].join("\n");
}

function formatVisibleEmails(emails: unknown) {
  if (!Array.isArray(emails) || emails.length === 0) {
    return ["### Visible emails", "- none"].join("\n");
  }

  const lines = emails
    .filter(isRecord)
    .flatMap((email, index) => [
      `${index + 1}. ${formatValue(email.id)} | ${formatEmailAddress(email)} | ${formatValue(
        email.subject,
      )} | ${email.read ? "read" : "unread"} | labels: ${formatValue(email.labels)} | date: ${formatValue(
        email.date,
      )}`,
    ]);

  return ["### Visible emails", ...(lines.length ? lines : ["- none"])].join("\n");
}

function formatMailAppContext(value: unknown) {
  const parsed = parseContextValue(value);
  if (!isRecord(parsed)) return formatValue(parsed);

  const appContext = parsed as MailAppContext;

  return [
    formatAccount(appContext.account, appContext.counts),
    formatSelectedEmail(appContext.selectedEmail),
    formatVisibleCompose(appContext.compose),
    formatActiveDraft(appContext.activeDraft),
    formatFilters(appContext.filters),
    formatVisibleEmails(appContext.visibleEmails),
  ].join("\n\n");
}

function formatRuntimeContext(context: readonly RuntimeContextItem[] | undefined) {
  const items = context ?? [];
  if (items.length === 0) return "";

  const sections = items.map((item) => formatMailAppContext(item.value)).filter(Boolean);
  if (sections.length === 0) return "";

  return [
    "## Runtime app context",
    "",
    "This is trusted UI state from the mail app. Use it only for the current user request.",
    "",
    ...sections,
  ].join("\n");
}

export function buildMailAssistantSystemPrompt(
  baseSystemPrompt: string,
  context: readonly RuntimeContextItem[] | undefined,
) {
  const runtimeContext = formatRuntimeContext(context);
  return runtimeContext ? `${baseSystemPrompt}\n\n${runtimeContext}` : baseSystemPrompt;
}

function createMailAssistantStreamTextOptions({
  ctx,
  model,
  providerOptions,
  systemPrompt,
  telemetry,
}: {
  readonly ctx: RuntimeFactoryContext;
  readonly model: StreamTextOptions["model"];
  readonly providerOptions: StreamTextOptions["providerOptions"];
  readonly systemPrompt: string;
  readonly telemetry?: StreamTextTelemetry;
}): StreamTextOptions {
  const tools = convertToolsToVercelAITools(ctx.input.tools);

  return {
    abortSignal: ctx.abortSignal,
    experimental_telemetry: telemetry,
    maxOutputTokens: 220,
    messages: convertMessagesToVercelAISDKMessages(ctx.input.messages),
    model,
    providerOptions,
    system: buildMailAssistantSystemPrompt(systemPrompt, ctx.input.context),
    temperature: 0.2,
    toolChoice: "auto",
    // CopilotKit and the app AI SDK resolve through different Zod peer instances.
    tools,
  } as unknown as StreamTextOptions;
}

export function runMailAssistantFactory<TResult>({
  ctx,
  model,
  providerOptions,
  streamText,
  systemPrompt,
  telemetry,
}: {
  readonly ctx: RuntimeFactoryContext;
  readonly model: StreamTextOptions["model"];
  readonly providerOptions: StreamTextOptions["providerOptions"];
  readonly streamText: (options: StreamTextOptions) => TResult;
  readonly systemPrompt: string;
  readonly telemetry?: StreamTextTelemetry;
}): TResult {
  return streamText(
    createMailAssistantStreamTextOptions({ ctx, model, providerOptions, systemPrompt, telemetry }),
  );
}
