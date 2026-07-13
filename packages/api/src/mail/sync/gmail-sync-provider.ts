import { env } from "@code-main/env/server";

import { getGmailThreadIfExists, listGmailHistory, watchGmailMailbox } from "../gmail-client";
import type { GmailSyncProvider } from "./processor";

const gmailUserId = "me";
const gmailHistoryPageMaxResults = 25;

export function createGmailSyncProvider(topicName = env.GMAIL_PUBSUB_TOPIC_NAME) {
  return {
    getThread: (accessToken: string, threadId: string) =>
      getGmailThreadIfExists(accessToken, gmailUserId, threadId),
    listHistory: (accessToken: string, startHistoryId: string) =>
      listGmailHistory({
        accessToken,
        maxResults: gmailHistoryPageMaxResults,
        startHistoryId,
        userId: gmailUserId,
      }),
    watchMailbox: (accessToken: string) =>
      watchGmailMailbox({
        accessToken,
        labelIds: ["INBOX"],
        topicName,
        userId: gmailUserId,
      }),
  } satisfies GmailSyncProvider;
}
