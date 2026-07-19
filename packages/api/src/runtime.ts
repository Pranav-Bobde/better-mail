import { Cause, Effect, Exit, Layer, ManagedRuntime } from "effect";

import { GmailClient } from "./mail/gmail-client";
import { MailboxService } from "./mail/mailbox-service";
import type { MailSyncEvent } from "./mail/sync/contracts";
import {
  MailSyncProcessor,
  type MailSyncProcessorRequestDependencies,
} from "./mail/sync/processor";
import { MailSyncRepository } from "./mail/sync/prisma-mail-sync-repository";

// Effect v4 canonical idioms for this repo (pinned via Phase-0 spike against 4.0.0-beta.99):
// - services: class X extends Context.Service<X, Shape>()("api/X") with static layer = Layer.effect(X, ...)
// - error recovery: Effect.catch / Effect.catchTag / Effect.catchCause (v3 catchAll* names do not exist)
// - handlers run effects via runtime.runPromise / runtime.runFork; never NodeRuntime.runMain (Next.js owns the process)
// - runtime.runPromise rejects with a wrapping FiberFailure, not the raw error: callers that need the
//   catalog EvlogError must unwrap it (runtime.runPromiseExit / Effect.result) — see Phase 2c/2d.

// Leaf IO services merge here; dependent services compose with provideMerge when the dependency remains public.
// MailboxService needs GmailClient; MailSyncProcessor needs MailSyncRepository — both stay public downstream.
export const AppLayer = Layer.mergeAll(MailboxService.layer, MailSyncProcessor.layer).pipe(
  Layer.provideMerge(Layer.mergeAll(GmailClient.layer, MailSyncRepository.layer)),
);

export const runtime = ManagedRuntime.make(AppLayer);

type RuntimeServices = ManagedRuntime.ManagedRuntime.Services<typeof runtime>;

/**
 * Runs a boundary effect against the singleton runtime and re-throws the raw
 * catalog error on failure. runtime.runPromise would reject with a wrapping
 * FiberFailure; squashing the Exit's cause restores the underlying EvlogError /
 * MailSyncLockBusyError so handler catch blocks (envelope conversion, queue
 * lock-busy retry) keep seeing the same value the promise helpers threw.
 */
export async function runRequest<A, E>(effect: Effect.Effect<A, E, RuntimeServices>) {
  const exit = await runtime.runPromiseExit(effect);

  if (Exit.isSuccess(exit)) {
    return exit.value;
  }

  throw Cause.squash(exit.cause);
}

/**
 * Boundary entrypoint for the Vercel queue worker: it cannot import `effect`,
 * so the processor effect is assembled here and run through the runtime, which
 * supplies the MailSyncRepository dependency. The by-design MailSyncLockBusyError
 * travels the error channel and is re-thrown raw for the worker's retry branch.
 */
export function runMailSyncEvent(
  event: MailSyncEvent,
  dependencies: MailSyncProcessorRequestDependencies,
) {
  return runRequest(
    Effect.flatMap(MailSyncProcessor, (processor) =>
      processor.processMailSyncEvent(event, dependencies),
    ),
  );
}
