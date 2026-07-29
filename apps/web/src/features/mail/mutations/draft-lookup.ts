import type { z } from "zod";

import type { listDraftsOutputSchema } from "@code-main/api/mail/contracts";

export type ListDraftsOutput = z.infer<typeof listDraftsOutputSchema>;

type DraftListEntry = Extract<ListDraftsOutput, { status: "ok" }>["data"]["drafts"][number];

export type DraftIdLookup = {
  readonly byMessageId: ReadonlyMap<string, string>;
  readonly byThreadId: ReadonlyMap<string, string>;
};

export function createDraftIdLookup(drafts: readonly DraftListEntry[]) {
  return {
    byMessageId: new Map(drafts.map((draft) => [draft.messageId, draft.draftId])),
    byThreadId: new Map(drafts.map((draft) => [draft.threadId, draft.draftId])),
  } satisfies DraftIdLookup;
}

// Drafts-folder rows come from getMailbox thread rows, whose `id` is the
// thread's latest message id — usually the draft message itself. The thread id
// fallback covers rows where they diverge (e.g. a draft reply on a thread).
export function resolveDraftId(
  lookup: DraftIdLookup,
  mail: { readonly id: string; readonly threadId: string },
) {
  return lookup.byMessageId.get(mail.id) ?? lookup.byThreadId.get(mail.threadId) ?? null;
}

export function removeDraftFromList(
  cachedDraftList: ListDraftsOutput | undefined,
  draftId: string,
) {
  if (!cachedDraftList || cachedDraftList.status === "error") {
    return cachedDraftList;
  }

  const remainingDrafts = cachedDraftList.data.drafts.filter((draft) => draft.draftId !== draftId);

  if (remainingDrafts.length === cachedDraftList.data.drafts.length) {
    return cachedDraftList;
  }

  return {
    ...cachedDraftList,
    data: {
      drafts: remainingDrafts,
    },
  };
}

export function getDraftThreadId(cachedDraftList: ListDraftsOutput | undefined, draftId: string) {
  if (!cachedDraftList || cachedDraftList.status === "error") {
    return null;
  }

  const match = cachedDraftList.data.drafts.find((draft) => draft.draftId === draftId);

  return match ? match.threadId : null;
}
