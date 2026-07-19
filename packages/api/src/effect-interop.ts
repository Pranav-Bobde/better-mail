import { Cause, Effect, Exit } from "effect";

/**
 * Effect.runPromise rejects with a wrapping FiberFailure, not the raw failure
 * value. Promise adapters that bridge Effect services back into promise-based
 * code must re-throw the raw catalog error (EvlogError / MailSyncLockBusyError)
 * so instanceof and .code checks keep seeing the same value the promise
 * helpers threw; squashing the Exit's cause restores it.
 */
export async function runPromiseRaw<A, E>(effect: Effect.Effect<A, E>): Promise<A> {
  const exit = await Effect.runPromiseExit(effect);

  if (Exit.isSuccess(exit)) {
    return exit.value;
  }

  throw Cause.squash(exit.cause);
}
