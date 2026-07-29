import { z } from "zod";

import { getMailboxOutputSchema, mailFolderSchema } from "@code-main/api/mail/contracts";

export type GetMailboxOutput = z.infer<typeof getMailboxOutputSchema>;

// Pure cache-patch helpers for optimistic mailbox updates. Each takes the
// cached getMailbox envelope (which may be an error entry or missing while a
// query is in flight) and returns the same reference when nothing changes so
// TanStack Query can skip no-op cache writes.

export function patchMailboxThreadRead(
  cachedMailbox: GetMailboxOutput | undefined,
  threadId: string,
  read: boolean,
) {
  if (!cachedMailbox || cachedMailbox.status === "error") {
    return cachedMailbox;
  }

  const hasThreadReadChange = cachedMailbox.data.messages.some(
    (message) => message.threadId === threadId && message.read !== read,
  );

  if (!hasThreadReadChange) {
    return cachedMailbox;
  }

  return {
    ...cachedMailbox,
    data: {
      ...cachedMailbox.data,
      messages: cachedMailbox.data.messages.map((message) =>
        message.threadId === threadId && message.read !== read ? { ...message, read } : message,
      ),
    },
  };
}

export function removeMailboxThread(cachedMailbox: GetMailboxOutput | undefined, threadId: string) {
  if (!cachedMailbox || cachedMailbox.status === "error") {
    return cachedMailbox;
  }

  const remainingMessages = cachedMailbox.data.messages.filter(
    (message) => message.threadId !== threadId,
  );

  if (remainingMessages.length === cachedMailbox.data.messages.length) {
    return cachedMailbox;
  }

  return {
    ...cachedMailbox,
    data: {
      ...cachedMailbox.data,
      messages: remainingMessages,
    },
  };
}

// @orpc/tanstack-query keys look like [path, { input, type }]; the folder the
// cache entry belongs to lives in the input. Used to scope optimistic removal
// to one folder's cached lists.
const mailboxQueryKeyStateSchema = z.object({
  input: z.object({
    folder: mailFolderSchema,
  }),
});

export function getMailboxQueryKeyFolder(queryKey: readonly unknown[]) {
  const parsedState = mailboxQueryKeyStateSchema.safeParse(queryKey[1]);
  return parsedState.success ? parsedState.data.input.folder : null;
}
