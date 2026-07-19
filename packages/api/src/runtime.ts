import { Layer, ManagedRuntime } from "effect";

import { GmailClient } from "./mail/gmail-client";
import { MailboxService } from "./mail/mailbox-service";
import { MailSyncRepository } from "./mail/sync/prisma-mail-sync-repository";

// Effect v4 canonical idioms for this repo (pinned via Phase-0 spike against 4.0.0-beta.99):
// - services: class X extends Context.Service<X, Shape>()("api/X") with static layer = Layer.effect(X, ...)
// - error recovery: Effect.catch / Effect.catchTag / Effect.catchCause (v3 catchAll* names do not exist)
// - handlers run effects via runtime.runPromise / runtime.runFork; never NodeRuntime.runMain (Next.js owns the process)
// - runtime.runPromise rejects with a wrapping FiberFailure, not the raw error: callers that need the
//   catalog EvlogError must unwrap it (runtime.runPromiseExit / Effect.result) — see Phase 2c/2d.

// Leaf IO services merge here; dependent services compose with provideMerge when the dependency remains public.
export const AppLayer = MailboxService.layer.pipe(
  Layer.provideMerge(Layer.mergeAll(GmailClient.layer, MailSyncRepository.layer)),
);

export const runtime = ManagedRuntime.make(AppLayer);
