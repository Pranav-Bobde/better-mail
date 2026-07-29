import assert from "node:assert/strict";

import { Effect } from "effect";
import type { Layer } from "effect";

// Shared Gmail test doubles for the mail test suites. This module must stay
// free of app imports so test files control env setup order themselves.

export type CapturedGmailFetch = {
  readonly bodies: string[];
  readonly requests: Request[];
};

export function captureGmailFetch(json: unknown): CapturedGmailFetch {
  const bodies: string[] = [];
  const requests: Request[] = [];

  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    requests.push(request);
    bodies.push(await request.text());

    return Response.json(json);
  };

  return { bodies, requests };
}

export function mockGmailJsonResponse(json: unknown, status = 200) {
  globalThis.fetch = async () => Response.json(json, { status });
}

export function mockGmailFailureResponse(status: number) {
  mockGmailJsonResponse({ error: { code: status } }, status);
}

export function rejectGmailFetch(reason: string) {
  globalThis.fetch = async () => {
    throw new Error(reason);
  };
}

export function assertGmailRequest(
  request: Request | undefined,
  expected: { readonly bearer: string; readonly method?: string; readonly url: string },
) {
  assert.ok(request);
  if (expected.method) {
    assert.equal(request.method, expected.method);
  }
  assert.equal(request.url, expected.url);
  assert.equal(request.headers.get("authorization"), `Bearer ${expected.bearer}`);
}

export function runServiceEffect<Service, A, E>(
  serviceLayer: Layer.Layer<Service>,
  effect: Effect.Effect<A, E, Service>,
): Promise<A> {
  return Effect.runPromise(Effect.provide(effect, serviceLayer));
}

export function hasMailErrorCode(error: unknown, code: string) {
  if (!(error instanceof Error) || !("code" in error)) {
    return false;
  }

  return error.code === code;
}

export const gmailModifyTestScopes = [
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.modify",
] as const;

export const gmailLegacyReadSendTestScopes = [
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
] as const;

export function createSignedInGmailContext(accessToken: string, scopes: readonly string[]) {
  return {
    getGoogleAccessToken: async () => ({
      accessToken,
      scopes,
    }),
    session: {
      session: {
        expiresAt: new Date("2026-06-13T12:00:00.000Z"),
        id: "session-id",
        token: "session-token",
        userId: "user-id",
      },
      user: {
        email: "demo-user@example.com",
        emailVerified: true,
        id: "user-id",
        image: null,
        name: "Demo User",
      },
    },
  };
}

// Records evlog-style operator context written by services under test so wide
// events (e.g. a failed mirror write) can be asserted, not just emitted.
export function createRecordingAuthLog() {
  const errors: unknown[] = [];
  const fields: Record<string, unknown>[] = [];

  return {
    errors,
    fields,
    log: {
      error(error: unknown) {
        errors.push(error);
      },
      set(nextFields: Record<string, unknown>) {
        fields.push(nextFields);
      },
    },
  };
}

export type FakeCachedThreadSeed = {
  readonly isInbox: boolean;
  readonly isRead: boolean;
  readonly labelIds: readonly string[];
  readonly threadId: string;
};

type FakeCachedThreadState = {
  isInbox: boolean;
  isRead: boolean;
  labelIds: string[];
  readonly threadId: string;
};

type FakeMirrorWrite = {
  readonly operation: "markCachedThreadArchived" | "markCachedThreadReadState";
  readonly read?: boolean;
  readonly threadId: string;
  readonly userId: string;
};

export const fakeMirrorWriteFailureMessage = "mirror write failed (test double)";

function createNotExercisedRepositoryMethod(method: string) {
  return async (): Promise<never> => {
    throw new Error(`${method} is not exercised by this test`);
  };
}

/**
 * Complete in-memory stand-in for the Prisma mail sync repository. Every
 * method exists (unexercised ones throw loudly), mirror writes are recorded
 * AND applied to the in-memory cache, and getCachedMailboxData serves reads
 * from that cache — so tests can assert the OUTCOME of a write-through
 * (mark read, then a cache-served mailbox read returns read: true), not just
 * that a Gmail request was sent.
 */
export function createFakeMailSyncRepository(
  options: {
    readonly mirrorWriteFailures?: number;
    readonly threads?: readonly FakeCachedThreadSeed[];
  } = {},
) {
  const threads = new Map<string, FakeCachedThreadState>(
    (options.threads ?? []).map((seed) => [
      seed.threadId,
      {
        isInbox: seed.isInbox,
        isRead: seed.isRead,
        labelIds: [...seed.labelIds],
        threadId: seed.threadId,
      },
    ]),
  );
  const mirrorWrites: FakeMirrorWrite[] = [];
  let remainingMirrorWriteFailures = options.mirrorWriteFailures ?? 0;

  const failMirrorWriteIfConfigured = () => {
    if (remainingMirrorWriteFailures > 0) {
      remainingMirrorWriteFailures -= 1;
      throw new Error(fakeMirrorWriteFailureMessage);
    }
  };

  const repository = {
    acquireSyncLock: createNotExercisedRepositoryMethod("acquireSyncLock"),
    applyGmailThread: createNotExercisedRepositoryMethod("applyGmailThread"),
    findGmailMailAccountsDueForWatchRenewal: createNotExercisedRepositoryMethod(
      "findGmailMailAccountsDueForWatchRenewal",
    ),
    findRecentlyActiveGmailMailAccountByEmail: createNotExercisedRepositoryMethod(
      "findRecentlyActiveGmailMailAccountByEmail",
    ),
    getActiveMailAccountWithCursor: createNotExercisedRepositoryMethod(
      "getActiveMailAccountWithCursor",
    ),
    getCachedMailboxData: async (input: {
      readonly folder: string;
      readonly query: string;
      readonly userId: string;
      readonly view: string;
    }) => {
      if (input.query.trim().length > 0) {
        return null;
      }

      const cachedThreads = [...threads.values()].filter(
        (thread) =>
          isThreadInFakeCachedFolder(thread, input.folder) &&
          (input.view === "unread" ? !thread.isRead : true),
      );

      if (cachedThreads.length === 0) {
        return null;
      }

      return {
        data: {
          account: {
            email: "demo-user@example.com",
            label: "demo-user",
          },
          messages: cachedThreads.map((thread) => toFakeCachedMailMessage(thread)),
          source: "gmail" as const,
        },
        mailAccountId: "mail-account-1",
      };
    },
    markCachedThreadArchived: async (input: {
      readonly threadId: string;
      readonly userId: string;
    }) => {
      mirrorWrites.push({
        operation: "markCachedThreadArchived",
        threadId: input.threadId,
        userId: input.userId,
      });
      failMirrorWriteIfConfigured();

      const thread = threads.get(input.threadId);
      if (thread) {
        thread.isInbox = false;
        thread.labelIds = thread.labelIds.filter((labelId) => labelId !== "INBOX");
      }
    },
    markCachedThreadReadState: async (input: {
      readonly read: boolean;
      readonly threadId: string;
      readonly userId: string;
    }) => {
      mirrorWrites.push({
        operation: "markCachedThreadReadState",
        read: input.read,
        threadId: input.threadId,
        userId: input.userId,
      });
      failMirrorWriteIfConfigured();

      const thread = threads.get(input.threadId);
      if (thread) {
        thread.isRead = input.read;
        thread.labelIds = input.read
          ? thread.labelIds.filter((labelId) => labelId !== "UNREAD")
          : [...thread.labelIds.filter((labelId) => labelId !== "UNREAD"), "UNREAD"];
      }
    },
    markGmailMailboxActivity: async () => {},
    markGmailThreadDeleted: createNotExercisedRepositoryMethod("markGmailThreadDeleted"),
    markMailAccountAuthError: createNotExercisedRepositoryMethod("markMailAccountAuthError"),
    markMailAccountNeedsResync: createNotExercisedRepositoryMethod("markMailAccountNeedsResync"),
    releaseSyncLock: createNotExercisedRepositoryMethod("releaseSyncLock"),
    updateGmailWatch: createNotExercisedRepositoryMethod("updateGmailWatch"),
    updateSyncCursor: createNotExercisedRepositoryMethod("updateSyncCursor"),
    upsertGmailMailAccount: createNotExercisedRepositoryMethod("upsertGmailMailAccount"),
  };

  return {
    getThreadState: (threadId: string) => {
      const thread = threads.get(threadId);

      return thread
        ? {
            isInbox: thread.isInbox,
            isRead: thread.isRead,
            labelIds: [...thread.labelIds],
            threadId: thread.threadId,
          }
        : null;
    },
    mirrorWrites,
    repository,
  };
}

function isThreadInFakeCachedFolder(thread: FakeCachedThreadState, folder: string) {
  if (folder === "inbox") {
    return thread.isInbox;
  }

  if (folder === "archive") {
    return !thread.isInbox;
  }

  return true;
}

function toFakeCachedMailMessage(thread: FakeCachedThreadState) {
  const labels: string[] = [];

  return {
    date: "2026-06-13T11:00:00.000Z",
    email: "sender@example.com",
    html: "<p>Cached body</p>",
    id: `${thread.threadId}-latest-message`,
    labels,
    name: "Cached Sender",
    read: !thread.labelIds.includes("UNREAD"),
    snippet: "Cached snippet",
    subject: "Cached subject",
    text: "Cached body",
    threadId: thread.threadId,
  };
}

export const gmailDraftTestIds = {
  draftId: "r-7481991503868632340",
  messageId: "18c2f5f6c5f9f101",
  threadId: "199aa11bb22cc330",
} as const;

export function createGmailDraftResponse() {
  return {
    id: gmailDraftTestIds.draftId,
    message: {
      id: gmailDraftTestIds.messageId,
      labelIds: ["DRAFT"],
      threadId: gmailDraftTestIds.threadId,
    },
  };
}

export function createGmailModifyThreadResponse(labelIds: readonly string[] = ["INBOX"]) {
  return {
    historyId: "987660",
    id: gmailDraftTestIds.threadId,
    messages: [
      {
        id: "199aa22cc33dd441",
        labelIds: [...labelIds],
        threadId: gmailDraftTestIds.threadId,
      },
    ],
  };
}
