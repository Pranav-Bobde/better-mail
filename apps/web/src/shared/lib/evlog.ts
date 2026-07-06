import type { DrainContext } from "evlog";
import { createFsDrain } from "evlog/fs";
import { createEvlog } from "evlog/next";
import { createInstrumentation } from "evlog/next/instrumentation";
import { createDrainPipeline } from "evlog/pipeline";

type EvlogDrainMode = "console" | "fs";

const drain = createDrainPipeline<DrainContext>({
  batch: {
    intervalMs: 1000,
    size: 25,
  },
  maxBufferSize: 5000,
  onDropped(events, error) {
    console.error("evlog drain dropped events", {
      count: events.length,
      error,
    });
  },
})(createEvlogDrain(getEvlogDrainMode(process.env)));

export const { log, withEvlog, useLogger } = createEvlog({
  drain,
  service: "code-main-web",
});

export const { register, onRequestError } = createInstrumentation({
  drain,
  service: "code-main-web",
});

export function getEvlogDrainMode(env: Partial<NodeJS.ProcessEnv>): EvlogDrainMode {
  if (env.VERCEL || env.VERCEL_ENV || env.NODE_ENV === "production") {
    return "console";
  }

  return "fs";
}

function createEvlogDrain(mode: EvlogDrainMode) {
  if (mode === "console") {
    return createConsoleDrain();
  }

  return createFsDrain({
    dir: ".evlog/logs",
    pretty: false,
  });
}

export function createConsoleDrain() {
  return async (ctx: DrainContext | DrainContext[]) => {
    const contexts = Array.isArray(ctx) ? ctx : [ctx];

    for (const context of contexts) {
      console.log(JSON.stringify(context.event));
    }
  };
}
