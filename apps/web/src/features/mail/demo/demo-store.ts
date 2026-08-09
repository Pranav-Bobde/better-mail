import type { DemoMailboxState } from "@/features/mail/demo/demo-mailbox-state";
import { createDemoMailboxState } from "@/features/mail/demo/demo-mailbox-state";

// Demo mode runs entirely in the browser tab, so a module-level mailbox is the
// whole persistence story: every transition is pure and this is the only
// mutable cell holding the result.
let demoMailboxState: DemoMailboxState = createDemoMailboxState();

export function getDemoMailboxState() {
  return demoMailboxState;
}

export function setDemoMailboxState(nextState: DemoMailboxState) {
  demoMailboxState = nextState;

  return demoMailboxState;
}

export function resetDemoStore() {
  demoMailboxState = createDemoMailboxState();

  return demoMailboxState;
}
