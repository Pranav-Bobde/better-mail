import assert from "node:assert/strict";
import test from "node:test";

import * as mailRealtimeServerModule from "@/shared/lib/mail-realtime-server";

test("Ably notifier publishes a mailboxChanged event to the user's private channel", async () => {
  const createNotifier = (mailRealtimeServerModule as Record<string, unknown>)
    .createAblyMailRealtimeNotifier;

  assert.equal(typeof createNotifier, "function");

  const publications: unknown[] = [];
  const notifier = (
    createNotifier as (client: unknown) => {
      publishMailboxChanged(input: unknown): Promise<void>;
    }
  )({
    channels: {
      get: (channelName: string) => ({
        publish: async (eventName: string, data: unknown) => {
          publications.push({ channelName, data, eventName });
        },
      }),
    },
  });

  await notifier.publishMailboxChanged({
    mailAccountId: "mail-account-id",
    mailboxVersion: "176009",
    type: "mailboxChanged",
    userId: "user-id",
  });

  assert.deepEqual(publications, [
    {
      channelName: "mailbox:user:user-id",
      data: {
        mailAccountId: "mail-account-id",
        mailboxVersion: "176009",
        type: "mailboxChanged",
      },
      eventName: "mailboxChanged",
    },
  ]);
});

test("Ably token request is short-lived and subscribe-only for one user channel", async () => {
  const createTokenRequest = (mailRealtimeServerModule as Record<string, unknown>)
    .createMailboxAblyTokenRequest;

  assert.equal(typeof createTokenRequest, "function");

  const tokenParams: unknown[] = [];
  const realShapedTokenRequest = {
    capability: '{"mailbox:user:user-id":["subscribe"]}',
    clientId: "user-id",
    keyName: "2COlaA.test-key",
    mac: "real-shaped-hmac-value",
    nonce: "real-shaped-token-nonce",
    timestamp: 1_783_968_000_000,
    ttl: 1_800_000,
  };
  const result = await (
    createTokenRequest as (client: unknown, userId: string) => Promise<unknown>
  )(
    {
      auth: {
        createTokenRequest: async (input: unknown) => {
          tokenParams.push(input);
          return realShapedTokenRequest;
        },
      },
    },
    "user-id",
  );

  assert.deepEqual(tokenParams, [
    {
      capability: '{"mailbox:user:user-id":["subscribe"]}',
      clientId: "user-id",
      ttl: 1_800_000,
    },
  ]);
  assert.deepEqual(result, realShapedTokenRequest);
});

test("realtime auth response requires a session and returns the Ably token shape", async () => {
  const createAuthResponse = (mailRealtimeServerModule as Record<string, unknown>)
    .createMailboxRealtimeAuthResponse;

  assert.equal(typeof createAuthResponse, "function");

  const requestUserIds: string[] = [];
  const requestToken = async (userId: string) => {
    requestUserIds.push(userId);
    return {
      capability: '{"mailbox:user:user-id":["subscribe"]}',
      clientId: userId,
      keyName: "2COlaA.test-key",
      mac: "real-shaped-hmac-value",
      nonce: "real-shaped-token-nonce",
      timestamp: 1_783_968_000_000,
      ttl: 1_800_000,
    };
  };

  const unauthenticatedResponse = await (
    createAuthResponse as (
      userId: string | null,
      requestToken: (userId: string) => Promise<unknown>,
    ) => Promise<Response>
  )(null, requestToken);
  const authenticatedResponse = await (
    createAuthResponse as (
      userId: string | null,
      requestToken: (userId: string) => Promise<unknown>,
    ) => Promise<Response>
  )("user-id", requestToken);

  assert.equal(unauthenticatedResponse.status, 200);
  assert.deepEqual(await unauthenticatedResponse.json(), {
    error: "UNAUTHENTICATED",
    status: "error",
  });
  assert.deepEqual(await authenticatedResponse.json(), {
    capability: '{"mailbox:user:user-id":["subscribe"]}',
    clientId: "user-id",
    keyName: "2COlaA.test-key",
    mac: "real-shaped-hmac-value",
    nonce: "real-shaped-token-nonce",
    timestamp: 1_783_968_000_000,
    ttl: 1_800_000,
  });
  assert.deepEqual(requestUserIds, ["user-id"]);
});
