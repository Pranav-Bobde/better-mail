import { z } from "zod";

import { mailErrors } from "./errors";
import type { GmailHistoryListResponse, GmailWatchResponse } from "./gmail-schemas";
import {
  gmailHistoryListResponseSchema,
  gmailLabelResponseSchema,
  gmailLabelsListResponseSchema,
  gmailListMessagesResponseSchema,
  gmailListThreadsResponseSchema,
  gmailProfileResponseSchema,
  gmailSendResponseSchema,
  gmailThreadResponseSchema,
  gmailWatchResponseSchema,
} from "./gmail-schemas";

const gmailApiBaseUrl = "https://gmail.googleapis.com/gmail/v1";

type GmailListInput = {
  readonly accessToken: string;
  readonly includeSpamTrash?: boolean;
  readonly labelIds?: readonly string[];
  readonly maxResults: number;
  readonly query?: string;
  readonly userId: string;
};

type GmailListErrorFields = {
  readonly dependencyStatus?: number;
  readonly labelIds?: string;
  readonly query?: string;
  readonly userId: string;
};

export async function getGmailProfile(accessToken: string, userId: string) {
  const response = await fetchGmail(accessToken, `/users/${encodeURIComponent(userId)}/profile`);

  if (!response.ok) {
    throw mailErrors.GMAIL_GET_PROFILE_FAILED({
      cause: new Error(`Gmail profile endpoint returned HTTP ${response.status}`),
      internal: {
        dependencyStatus: response.status,
        userId,
      },
    });
  }

  const parsedProfile = gmailProfileResponseSchema.safeParse(await response.json());
  if (!parsedProfile.success) {
    throw mailErrors.GMAIL_GET_PROFILE_RESPONSE_INVALID({
      cause: new Error(z.prettifyError(parsedProfile.error)),
      internal: {
        userId,
      },
    });
  }

  return parsedProfile.data;
}

export async function listGmailMessages({
  accessToken,
  includeSpamTrash = false,
  labelIds,
  maxResults,
  query,
  userId,
}: GmailListInput) {
  return listGmailResource({
    accessToken,
    createFailedError: (cause, internal) =>
      mailErrors.GMAIL_LIST_MESSAGES_FAILED({ cause, internal }),
    createInvalidError: (cause, internal) =>
      mailErrors.GMAIL_LIST_MESSAGES_RESPONSE_INVALID({ cause, internal }),
    includeSpamTrash,
    labelIds,
    maxResults,
    query,
    resource: "messages",
    responseSchema: gmailListMessagesResponseSchema,
    userId,
  });
}

export async function listGmailThreads({
  accessToken,
  includeSpamTrash = false,
  labelIds,
  maxResults,
  query,
  userId,
}: GmailListInput) {
  return listGmailResource({
    accessToken,
    createFailedError: (cause, internal) =>
      mailErrors.GMAIL_LIST_THREADS_FAILED({ cause, internal }),
    createInvalidError: (cause, internal) =>
      mailErrors.GMAIL_LIST_THREADS_RESPONSE_INVALID({ cause, internal }),
    includeSpamTrash,
    labelIds,
    maxResults,
    query,
    resource: "threads",
    responseSchema: gmailListThreadsResponseSchema,
    userId,
  });
}

export async function getGmailThread(accessToken: string, userId: string, threadId: string) {
  const response = await requestGmailThread(accessToken, userId, threadId);
  return parseGmailThreadResponse(response, userId, threadId);
}

export async function getGmailThreadIfExists(
  accessToken: string,
  userId: string,
  threadId: string,
) {
  const response = await requestGmailThread(accessToken, userId, threadId);

  if (response.status === 404) {
    return null;
  }

  return parseGmailThreadResponse(response, userId, threadId);
}

async function requestGmailThread(accessToken: string, userId: string, threadId: string) {
  const searchParams = new URLSearchParams({
    format: "full",
  });
  const path = `/users/${encodeURIComponent(userId)}/threads/${encodeURIComponent(
    threadId,
  )}?${searchParams.toString()}`;
  return fetchGmail(accessToken, path);
}

async function parseGmailThreadResponse(response: Response, userId: string, threadId: string) {
  if (!response.ok) {
    throw mailErrors.GMAIL_GET_THREAD_FAILED({
      cause: new Error(`Gmail threads.get endpoint returned HTTP ${response.status}`),
      internal: {
        dependencyStatus: response.status,
        threadId,
        userId,
      },
    });
  }

  const parsedThread = gmailThreadResponseSchema.safeParse(await response.json());
  if (!parsedThread.success) {
    throw mailErrors.GMAIL_GET_THREAD_RESPONSE_INVALID({
      cause: new Error(z.prettifyError(parsedThread.error)),
      internal: {
        threadId,
        userId,
      },
    });
  }

  return parsedThread.data;
}

export async function listGmailLabels(accessToken: string, userId: string) {
  const response = await fetchGmail(accessToken, `/users/${encodeURIComponent(userId)}/labels`);

  if (!response.ok) {
    throw mailErrors.GMAIL_LIST_LABELS_FAILED({
      cause: new Error(`Gmail labels.list endpoint returned HTTP ${response.status}`),
      internal: {
        dependencyStatus: response.status,
        userId,
      },
    });
  }

  const parsedLabels = gmailLabelsListResponseSchema.safeParse(await response.json());
  if (!parsedLabels.success) {
    throw mailErrors.GMAIL_LIST_LABELS_RESPONSE_INVALID({
      cause: new Error(z.prettifyError(parsedLabels.error)),
      internal: {
        userId,
      },
    });
  }

  return parsedLabels.data.labels ?? [];
}

export async function getGmailLabel(accessToken: string, userId: string, labelId: string) {
  const path = `/users/${encodeURIComponent(userId)}/labels/${encodeURIComponent(labelId)}`;
  const response = await fetchGmail(accessToken, path);

  if (!response.ok) {
    throw mailErrors.GMAIL_GET_LABEL_FAILED({
      cause: new Error(`Gmail labels.get endpoint returned HTTP ${response.status}`),
      internal: {
        dependencyStatus: response.status,
        labelId,
        userId,
      },
    });
  }

  const parsedLabel = gmailLabelResponseSchema.safeParse(await response.json());
  if (!parsedLabel.success) {
    throw mailErrors.GMAIL_GET_LABEL_RESPONSE_INVALID({
      cause: new Error(z.prettifyError(parsedLabel.error)),
      internal: {
        labelId,
        userId,
      },
    });
  }

  return parsedLabel.data;
}

export async function sendGmailMessage({
  accessToken,
  raw,
  threadId,
  userId,
}: {
  readonly accessToken: string;
  readonly raw: string;
  readonly threadId?: string;
  readonly userId: string;
}) {
  const response = await fetchGmail(
    accessToken,
    `/users/${encodeURIComponent(userId)}/messages/send`,
    {
      body: JSON.stringify({
        raw,
        threadId,
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    },
  );

  if (!response.ok) {
    throw mailErrors.GMAIL_SEND_MESSAGE_FAILED({
      cause: new Error(`Gmail messages.send endpoint returned HTTP ${response.status}`),
      internal: {
        dependencyStatus: response.status,
        hasThreadId: Boolean(threadId),
        userId,
      },
    });
  }

  const parsedSend = gmailSendResponseSchema.safeParse(await response.json());
  if (!parsedSend.success) {
    throw mailErrors.GMAIL_SEND_RESPONSE_INVALID({
      cause: new Error(z.prettifyError(parsedSend.error)),
      internal: {
        userId,
      },
    });
  }

  return parsedSend.data;
}

export async function listGmailHistory({
  accessToken,
  maxResults,
  pageToken,
  startHistoryId,
  userId,
}: {
  readonly accessToken: string;
  readonly maxResults: number;
  readonly pageToken?: string;
  readonly startHistoryId: string;
  readonly userId: string;
}): Promise<GmailHistoryListResponse> {
  const searchParams = new URLSearchParams({
    maxResults: String(maxResults),
    startHistoryId,
  });

  if (pageToken) {
    searchParams.set("pageToken", pageToken);
  }

  const response = await fetchGmail(
    accessToken,
    `/users/${encodeURIComponent(userId)}/history?${searchParams.toString()}`,
  );

  if (response.status === 404) {
    throw mailErrors.GMAIL_HISTORY_EXPIRED({
      cause: new Error(`Gmail users.history.list endpoint returned HTTP ${response.status}`),
      internal: {
        dependencyStatus: response.status,
        startHistoryId,
        userId,
      },
    });
  }

  if (!response.ok) {
    throw mailErrors.GMAIL_HISTORY_LIST_FAILED({
      cause: new Error(`Gmail users.history.list endpoint returned HTTP ${response.status}`),
      internal: {
        dependencyStatus: response.status,
        startHistoryId,
        userId,
      },
    });
  }

  const parsedHistory = gmailHistoryListResponseSchema.safeParse(await response.json());
  if (!parsedHistory.success) {
    throw mailErrors.GMAIL_HISTORY_LIST_RESPONSE_INVALID({
      cause: new Error(z.prettifyError(parsedHistory.error)),
      internal: {
        startHistoryId,
        userId,
      },
    });
  }

  return parsedHistory.data;
}

export async function watchGmailMailbox({
  accessToken,
  labelIds,
  topicName,
  userId,
}: {
  readonly accessToken: string;
  readonly labelIds?: readonly string[];
  readonly topicName: string;
  readonly userId: string;
}): Promise<GmailWatchResponse> {
  const response = await fetchGmail(accessToken, `/users/${encodeURIComponent(userId)}/watch`, {
    body: JSON.stringify(createGmailWatchBody(topicName, labelIds)),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw mailErrors.GMAIL_WATCH_FAILED({
      cause: new Error(`Gmail users.watch endpoint returned HTTP ${response.status}`),
      internal: {
        dependencyStatus: response.status,
        topicName,
        userId,
      },
    });
  }

  const parsedWatch = gmailWatchResponseSchema.safeParse(await response.json());
  if (!parsedWatch.success) {
    throw mailErrors.GMAIL_WATCH_RESPONSE_INVALID({
      cause: new Error(z.prettifyError(parsedWatch.error)),
      internal: {
        topicName,
        userId,
      },
    });
  }

  return parsedWatch.data;
}

function createGmailWatchBody(topicName: string, labelIds: readonly string[] | undefined) {
  const hasLabelFilter = Boolean(labelIds?.length);

  return {
    labelFilterBehavior: hasLabelFilter ? "INCLUDE" : undefined,
    labelIds,
    topicName,
  };
}

async function fetchGmail(accessToken: string, path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.set("authorization", `Bearer ${accessToken}`);

  return fetch(`${gmailApiBaseUrl}${path}`, {
    ...init,
    headers,
  });
}

async function listGmailResource<T>({
  accessToken,
  createFailedError,
  createInvalidError,
  includeSpamTrash = false,
  labelIds,
  maxResults,
  query,
  resource,
  responseSchema,
  userId,
}: GmailListInput & {
  readonly createFailedError: (cause: Error, internal: GmailListErrorFields) => Error;
  readonly createInvalidError: (
    cause: Error,
    internal: Pick<GmailListErrorFields, "query" | "userId">,
  ) => Error;
  readonly resource: "messages" | "threads";
  readonly responseSchema: z.ZodType<T>;
}) {
  const path = `/users/${encodeURIComponent(userId)}/${resource}?${createListSearchParams({
    includeSpamTrash,
    labelIds,
    maxResults,
    query,
  }).toString()}`;
  const response = await fetchGmail(accessToken, path);

  if (!response.ok) {
    throw createFailedError(
      new Error(`Gmail ${resource}.list endpoint returned HTTP ${response.status}`),
      {
        dependencyStatus: response.status,
        labelIds: labelIds?.join(","),
        query,
        userId,
      },
    );
  }

  const parsedList = responseSchema.safeParse(await response.json());
  if (!parsedList.success) {
    throw createInvalidError(new Error(z.prettifyError(parsedList.error)), {
      query,
      userId,
    });
  }

  return parsedList.data;
}

function createListSearchParams({
  includeSpamTrash,
  labelIds,
  maxResults,
  query,
}: {
  readonly includeSpamTrash: boolean;
  readonly labelIds?: readonly string[];
  readonly maxResults: number;
  readonly query?: string;
}) {
  const searchParams = new URLSearchParams({
    includeSpamTrash: String(includeSpamTrash),
    maxResults: String(maxResults),
  });

  addSearchQuery(searchParams, query);
  addSearchLabelIds(searchParams, labelIds ?? []);

  return searchParams;
}

function addSearchQuery(searchParams: URLSearchParams, query: string | undefined) {
  if (query) {
    searchParams.set("q", query);
  }
}

function addSearchLabelIds(searchParams: URLSearchParams, labelIds: readonly string[]) {
  for (const labelId of labelIds) {
    searchParams.append("labelIds", labelId);
  }
}
