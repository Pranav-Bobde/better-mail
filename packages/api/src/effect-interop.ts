import { Cause, Effect, Exit } from "effect";
import { EvlogError } from "evlog";

export function isEvlogError(error: unknown): error is EvlogError {
  return error instanceof EvlogError;
}

/**
 * Bridges a promise-based request into the Effect error channel without type
 * assertions: rejections matching the guard become typed failures, anything
 * else is a defect. Defects still surface raw at the boundary via
 * runPromiseRaw, matching what the promise helpers threw.
 */
export function tryPromiseExpecting<A, E>(
  run: () => Promise<A>,
  isExpectedError: (error: unknown) => error is E,
) {
  return Effect.tryPromise({ catch: (error) => error, try: run }).pipe(
    Effect.catch((error) => (isExpectedError(error) ? Effect.fail(error) : Effect.die(error))),
  );
}

/**
 * Effect.runPromise rejects with a wrapping FiberFailure, not the raw failure
 * value. Promise adapters that bridge Effect services back into promise-based
 * code must re-throw the raw catalog error (EvlogError / MailSyncLockBusyError)
 * so instanceof and .code checks keep seeing the same value the promise
 * helpers threw; squashing the Exit's cause restores it.
 */
export async function runPromiseRaw<A, E>(effect: Effect.Effect<A, E>) {
  const exit = await Effect.runPromiseExit(effect);

  if (Exit.isSuccess(exit)) {
    return exit.value;
  }

  throw Cause.squash(exit.cause);
}
