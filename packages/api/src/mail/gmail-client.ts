import { env } from "@code-main/env/server";
import { z } from "zod";

import { mailErrors } from "./errors";
import {
  gmailLabelResponseSchema,
  gmailLabelsListResponseSchema,
  gmailListMessagesResponseSchema,
  gmailMessageResponseSchema,
  gmailProfileResponseSchema,
  gmailSendResponseSchema,
  gmailTokenResponseSchema,
  gmailWatchResponseSchema,
} from "./gmail-schemas";

const gmailApiBaseUrl = "https://gmail.googleapis.com/gmail/v1";
const googleTokenUrl = "https://oauth2.googleapis.com/token";

export function getGmailConfig() {
  return {
    clientId: env.GMAIL_OAUTH_CLIENT_ID,
    clientSecret: env.GMAIL_OAUTH_CLIENT_SECRET,
    configured: true as const,
    refreshToken: env.GMAIL_OAUTH_REFRESH_TOKEN,
    userId: env.GMAIL_DEMO_USER,
  };
}

export function getGmailWatchConfig() {
  const config = getGmailConfig();

  return {
    ...config,
    configured: true as const,
    labelIds: getWatchLabelIds(),
    topicName: env.GMAIL_PUBSUB_TOPIC,
  };
}

export async function getGmailAccessToken(
  config: Extract<ReturnType<typeof getGmailConfig>, { configured: true }>,
) {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "refresh_token",
    refresh_token: config.refreshToken,
  });

  const response = await fetchGoogleToken(body);

  if (!response.ok) {
    throw mailErrors.GMAIL_ACCESS_TOKEN_REQUEST_FAILED({
      cause: new Error(`Google OAuth token endpoint returned HTTP ${response.status}`),
      internal: {
        dependencyStatus: response.status,
      },
    });
  }

  const parsedToken = gmailTokenResponseSchema.safeParse(await response.json());
  if (!parsedToken.success) {
    throw mailErrors.GMAIL_ACCESS_TOKEN_RESPONSE_INVALID({
      cause: new Error(z.prettifyError(parsedToken.error)),
    });
  }

  return parsedToken.data.access_token;
}

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
}: {
  readonly accessToken: string;
  readonly includeSpamTrash?: boolean;
  readonly labelIds?: readonly string[];
  readonly maxResults: number;
  readonly query?: string;
  readonly userId: string;
}) {
  const path = `/users/${encodeURIComponent(userId)}/messages?${createListMessagesSearchParams({
    includeSpamTrash,
    labelIds,
    maxResults,
    query,
  }).toString()}`;
  const response = await fetchGmail(accessToken, path);

  if (!response.ok) {
    throw mailErrors.GMAIL_LIST_MESSAGES_FAILED({
      cause: new Error(`Gmail messages.list endpoint returned HTTP ${response.status}`),
      internal: {
        dependencyStatus: response.status,
        labelIds: labelIds?.join(","),
        query,
        userId,
      },
    });
  }

  const parsedList = gmailListMessagesResponseSchema.safeParse(await response.json());
  if (!parsedList.success) {
    throw mailErrors.GMAIL_LIST_MESSAGES_RESPONSE_INVALID({
      cause: new Error(z.prettifyError(parsedList.error)),
      internal: {
        query,
        userId,
      },
    });
  }

  return parsedList.data;
}

export async function getGmailMessage(accessToken: string, userId: string, messageId: string) {
  const searchParams = new URLSearchParams({
    format: "full",
  });
  const path = `/users/${encodeURIComponent(userId)}/messages/${encodeURIComponent(
    messageId,
  )}?${searchParams.toString()}`;
  const response = await fetchGmail(accessToken, path);

  if (!response.ok) {
    throw mailErrors.GMAIL_GET_MESSAGE_FAILED({
      cause: new Error(`Gmail messages.get endpoint returned HTTP ${response.status}`),
      internal: {
        dependencyStatus: response.status,
        messageId,
        userId,
      },
    });
  }

  const parsedMessage = gmailMessageResponseSchema.safeParse(await response.json());
  if (!parsedMessage.success) {
    throw mailErrors.GMAIL_GET_MESSAGE_RESPONSE_INVALID({
      cause: new Error(z.prettifyError(parsedMessage.error)),
      internal: {
        messageId,
        userId,
      },
    });
  }

  return parsedMessage.data;
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

export async function startGmailWatch({
  accessToken,
  labelIds,
  topicName,
  userId,
}: {
  readonly accessToken: string;
  readonly labelIds: readonly string[];
  readonly topicName: string;
  readonly userId: string;
}) {
  const response = await fetchGmail(accessToken, `/users/${encodeURIComponent(userId)}/watch`, {
    body: JSON.stringify({
      labelFilterBehavior: "INCLUDE",
      labelIds,
      topicName,
    }),
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
        labelIds: labelIds.join(","),
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
        labelIds: labelIds.join(","),
        topicName,
        userId,
      },
    });
  }

  return parsedWatch.data;
}

async function fetchGmail(accessToken: string, path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.set("authorization", `Bearer ${accessToken}`);

  return fetch(`${gmailApiBaseUrl}${path}`, {
    ...init,
    headers,
  });
}

async function fetchGoogleToken(body: URLSearchParams) {
  try {
    return await fetch(googleTokenUrl, {
      body,
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      method: "POST",
    });
  } catch (error) {
    throw mailErrors.GMAIL_ACCESS_TOKEN_REQUEST_FAILED({
      cause: getErrorCause(error),
      internal: {
        dependencyOperation: "fetch",
        url: redactGoogleUrl(googleTokenUrl),
      },
    });
  }
}

function getWatchLabelIds() {
  return env.GMAIL_WATCH_LABEL_IDS.split(",")
    .map((labelId) => labelId.trim())
    .filter((labelId) => labelId.length > 0);
}

function createListMessagesSearchParams({
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

function redactGoogleUrl(url: string) {
  return new URL(url).origin;
}

function getErrorCause(error: unknown) {
  if (error instanceof Error) {
    return error;
  }

  return new Error("Unknown Gmail fetch failure");
}
