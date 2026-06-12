import * as ai from "ai";
import {
  BuiltInAgent,
  CopilotRuntime,
  InMemoryAgentRunner,
  createCopilotRuntimeHandler,
} from "@copilotkit/runtime/v2";
import { env } from "@code-main/env/server";
import { Client } from "langsmith";
import { LangSmithTelemetry } from "langsmith/experimental/vercel";

import {
  createOpenRouter,
  mailAssistantSystemPrompt,
  openRouterRoutingOptions,
} from "./mail-assistant";
import { runMailAssistantFactory } from "./mail-copilot-runtime-options";

const mailCopilotRuntime = new CopilotRuntime({
  agents: {
    default: new BuiltInAgent({
      type: "aisdk",
      async factory(ctx) {
        const langsmith = new Client({
          apiKey: env.LANGSMITH_API_KEY,
        });
        const telemetry = LangSmithTelemetry({
          client: langsmith,
          name: "mail-assistant",
          projectName: env.LANGSMITH_PROJECT,
        });
        const openrouter = createOpenRouter(env);

        return runMailAssistantFactory({
          ctx,
          model: openrouter.chat(env.OPENROUTER_MODEL),
          providerOptions: openRouterRoutingOptions,
          streamText: ai.streamText,
          systemPrompt: mailAssistantSystemPrompt,
          telemetry: {
            functionId: "mail-assistant",
            integrations: [telemetry],
            isEnabled: true,
          },
        });
      },
    }),
  },
  runner: new InMemoryAgentRunner(),
});

export function createMailCopilotRuntimeHandler() {
  return createCopilotRuntimeHandler({
    basePath: "/api/copilotkit",
    mode: "single-route",
    runtime: mailCopilotRuntime,
  });
}
