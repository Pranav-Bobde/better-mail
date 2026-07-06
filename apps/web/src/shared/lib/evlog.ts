import type { DrainContext } from "evlog";
import { createFsDrain } from "evlog/fs";
import { createEvlog } from "evlog/next";
import { createInstrumentation } from "evlog/next/instrumentation";
import { createDrainPipeline } from "evlog/pipeline";

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
})(
  createFsDrain({
    dir: ".evlog/logs",
    pretty: false,
  }),
);

export const { log, withEvlog, useLogger } = createEvlog({
  drain,
  service: "code-main-web",
});

export const { register, onRequestError } = createInstrumentation({
  drain,
  service: "code-main-web",
});
