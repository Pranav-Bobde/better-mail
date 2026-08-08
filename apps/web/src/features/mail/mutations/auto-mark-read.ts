// Guard for auto-marking an opened thread as read: fire once per thread
// selection. Tracking the last thread we fired for (rather than in-flight
// state) means an error rollback that leaves the thread unread cannot retrigger
// the mutation in a loop while the same thread stays selected.
export function shouldAutoMarkThreadRead(
  selectedThread: { readonly read: boolean; readonly threadId: string } | null,
  lastAutoMarkedThreadId: string | null,
  manualUnreadThreadIds: ReadonlySet<string> = new Set(),
) {
  if (!selectedThread || selectedThread.read) {
    return false;
  }

  return (
    selectedThread.threadId !== lastAutoMarkedThreadId &&
    !manualUnreadThreadIds.has(selectedThread.threadId)
  );
}

export function setManualUnreadIntent(
  current: ReadonlySet<string>,
  threadId: string,
  preserveUnread: boolean,
) {
  if (current.has(threadId) === preserveUnread) {
    return current;
  }

  const next = new Set(current);
  if (preserveUnread) {
    next.add(threadId);
  } else {
    next.delete(threadId);
  }
  return next;
}

export function resetAutoMarkGuardForSelection(
  selectedThreadId: string | null,
  previousSelectedThreadId: string | null,
  lastAutoMarkedThreadId: string | null,
) {
  return selectedThreadId === previousSelectedThreadId ? lastAutoMarkedThreadId : null;
}
