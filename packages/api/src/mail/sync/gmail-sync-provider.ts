import { env } from "@code-main/env/server";

import { getGmailThreadIfExists, listGmailHistory, watchGmailMailbox } from "../gmail-client";
import type { GmailHistoryListResponse } from "../gmail-schemas";
import type { GmailSyncProvider } from "./processor";

const gmailUserId = "me";

export function createGmailSyncProvider(topicName = env.GMAIL_PUBSUB_TOPIC_NAME) {
  return {
    getThread: (accessToken: string, threadId: string) =>
      getGmailThreadIfExists(accessToken, gmailUserId, threadId),
    listHistory: (accessToken: string, startHistoryId: string) =>
      listAllGmailHistory(accessToken, startHistoryId),
    watchMailbox: (accessToken: string) =>
      watchGmailMailbox({
        accessToken,
        labelIds: ["INBOX"],
        topicName,
        userId: gmailUserId,
      }),
  } satisfies GmailSyncProvider;
}

async function listAllGmailHistory(accessToken: string, startHistoryId: string) {
  const mutableResult: {
    history: NonNullable<GmailHistoryListResponse["history"]>;
    historyId: string | undefined;
  } = {
    history: [],
    historyId: undefined,
  };
  let pageToken: string | undefined;

  do {
    const page = await getGmailHistoryPage(accessToken, startHistoryId, pageToken);
    mutableResult.history.push(...(page.history ?? []));
    mutableResult.historyId = page.historyId ?? mutableResult.historyId;
    pageToken = page.nextPageToken;
  } while (pageToken);

  return mutableResult;
}

function getGmailHistoryPage(
  accessToken: string,
  startHistoryId: string,
  pageToken: string | undefined,
) {
  return listGmailHistory({
    accessToken,
    pageToken,
    startHistoryId,
    userId: gmailUserId,
  });
}
