import { Layer, ManagedRuntime } from "effect";

// Effect v4 canonical idioms for this repo (pinned via Phase-0 spike against 4.0.0-beta.99):
// - services: class X extends Context.Service<X, Shape>()("api/X") with static layer = Layer.effect(X, ...)
// - error recovery: Effect.catch / Effect.catchTag / Effect.catchCause (v3 catchAll* names do not exist)
// - handlers run effects via runtime.runPromise / runtime.runFork; never NodeRuntime.runMain (Next.js owns the process)

export const AppLayer = Layer.empty;

export const runtime = ManagedRuntime.make(AppLayer);
