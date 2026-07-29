// Guard for auto-marking an opened thread as read: fire once per thread
// selection. Tracking the last thread we fired for (rather than in-flight
// state) means an error rollback that leaves the thread unread cannot retrigger
// the mutation in a loop while the same thread stays selected.
export function shouldAutoMarkThreadRead(
  selectedThread: { readonly read: boolean; readonly threadId: string } | null,
  lastAutoMarkedThreadId: string | null,
) {
  if (!selectedThread || selectedThread.read) {
    return false;
  }

  return selectedThread.threadId !== lastAutoMarkedThreadId;
}
