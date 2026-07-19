import assert from "node:assert/strict";

import { test } from "vitest";

import {
  convertMessagesToVercelAISDKMessages,
  convertToolsToVercelAITools,
} from "@copilotkit/runtime/v2";

import { mailAssistantSystemPrompt, openRouterRoutingOptions } from "./mail-assistant";
import {
  buildMailAssistantSystemPrompt,
  runMailAssistantFactory,
  type RuntimeFactoryContext,
} from "./mail-copilot-runtime-options";

test("copilot runtime converts messages and frontend tools to AI SDK inputs", () => {
  const messages = convertMessagesToVercelAISDKMessages([
    {
      id: "msg_1",
      role: "user",
      content: "Draft an email to rohan@example.com",
    },
  ]);

  assert.deepEqual(messages, [
    {
      role: "user",
      content: "Draft an email to rohan@example.com",
    },
  ]);

  const tools = convertToolsToVercelAITools([
    {
      name: "draftEmail",
      description: "Draft and visibly fill the compose form.",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string" },
          subject: { type: "string" },
          body: { type: "string" },
        },
        required: ["to", "subject", "body"],
      },
    },
  ]);

  assert.deepEqual(Object.keys(tools), ["draftEmail"]);
});

test("assistant prompt requires visible UI control and human approval before send", () => {
  assert.match(mailAssistantSystemPrompt, /visibly fill/i);
  assert.match(mailAssistantSystemPrompt, /human approval/i);
  assert.match(mailAssistantSystemPrompt, /filterEmail/i);
  assert.match(mailAssistantSystemPrompt, /draftEmail/i);
  assert.match(mailAssistantSystemPrompt, /never say sent/i);
});

test("mail assistant factory passes formatted real-shaped context to AI SDK", () => {
  const abortController = new AbortController();
  const runtimeContext = [
    {
      description:
        "Current mail app state. Use selectedEmail only for selected/current/this email requests.",
      value: JSON.stringify({
        account: {
          email: "demo-user@example.com",
          label: "Demo User",
        },
        counts: {
          inbox: 128,
          unread: 9,
          sent: 4,
        },
        filters: {
          query: "from:maya newer_than:10d",
          view: "unread",
        },
        selectedEmail: {
          id: "m_001",
          name: "Maya Rao",
          email: "maya@northstar.design",
          subject: "Design review moved to Thursday",
          read: false,
          labels: ["design", "review"],
          date: "2026-06-09T10:30:00.000Z",
          text: "Can you sanity-check the onboarding copy before the review?",
          threadId: "thread-001",
        },
        compose: {
          open: true,
          to: "rohan@gmail.com",
          subject: "Weekend update",
          body: "I am not going to make it this weekend.",
        },
        activeDraft: {
          to: "no-reply@smith.langchain.com",
          subject: "Re: Tracing project ready",
          body: "Hi LangSmith team,\n\nThanks for the update.",
        },
        visibleEmails: [
          {
            id: "m_001",
            name: "Maya Rao",
            email: "maya@northstar.design",
            subject: "Design review moved to Thursday",
            read: false,
            labels: ["design", "review"],
            date: "2026-06-09T10:30:00.000Z",
          },
        ],
      }),
    },
  ];
  const ctx: RuntimeFactoryContext = {
    input: {
      messages: [
        {
          id: "msg_1",
          role: "user" as const,
          content: "Summarize the selected email",
        },
      ],
      tools: [
        {
          name: "draftEmail",
          description: "Draft and visibly fill the compose form.",
          parameters: {
            type: "object",
            properties: {
              to: { type: "string" },
              subject: { type: "string" },
              body: { type: "string" },
            },
            required: ["to", "subject", "body"],
          },
        },
      ],
      context: runtimeContext,
    },
    abortSignal: abortController.signal,
  };
  let capturedOptions: CapturedStreamOptions | undefined;
  const telemetry = {
    functionId: "mail-assistant",
    isEnabled: true,
  };

  const result = runMailAssistantFactory({
    ctx,
    model: "mock-openrouter-model",
    providerOptions: openRouterRoutingOptions,
    streamText: (options) => {
      capturedOptions = options;
      return { ok: true };
    },
    systemPrompt: mailAssistantSystemPrompt,
    telemetry,
  });

  assert.deepEqual(result, { ok: true });
  const captured = requireCapturedOptions(capturedOptions);

  assert.equal(captured.model, "mock-openrouter-model");
  assert.equal(captured.abortSignal, abortController.signal);
  assert.deepEqual(captured.experimental_telemetry, telemetry);
  assert.deepEqual(captured.providerOptions, openRouterRoutingOptions);
  assert.deepEqual(captured.messages, [
    {
      role: "user",
      content: "Summarize the selected email",
    },
  ]);
  assert.deepEqual(Object.keys(captured.tools ?? {}), ["draftEmail"]);

  const system = buildMailAssistantSystemPrompt(mailAssistantSystemPrompt, runtimeContext);
  assert.equal(captured.system, system);
  assert.match(system, /## Runtime app context/);
  assert.match(system, /Maya Rao <maya@northstar\.design>/);
  assert.match(system, /### Visible compose form/);
  assert.match(system, /rohan@gmail\.com/);
  assert.match(system, /### Active draft preview/);
  assert.match(system, /no-reply@smith\.langchain\.com/);
  assert.match(system, /### Visible emails/);
  assert.doesNotMatch(system, /\[object Object\]/);
});

type CapturedStreamOptions = {
  readonly abortSignal?: AbortSignal;
  readonly experimental_telemetry?: unknown;
  readonly messages?: unknown;
  readonly model?: unknown;
  readonly providerOptions?: unknown;
  readonly system?: unknown;
  readonly tools?: Record<string, unknown>;
};

function requireCapturedOptions(options: CapturedStreamOptions | undefined) {
  assert.ok(options);

  return options;
}
