import assert from "node:assert/strict";
import test from "node:test";

import { createAblyMailRealtimeSubscriber } from "@/features/mail/realtime/mail-realtime-client";

test("Ably subscriber delivers valid mailboxChanged messages and cleans up", async () => {
  const operations: string[] = [];
  type TestAblyMessage = {
    readonly clientId?: string;
    readonly connectionId?: string;
    readonly data?: unknown;
    readonly id?: string;
    readonly name?: string;
    readonly timestamp?: number;
  };
  const listenerState: {
    current: ((message: TestAblyMessage) => void) | null;
  } = { current: null };
  const subscriber = createAblyMailRealtimeSubscriber(() => ({
    channels: {
      get: (channelName: string) => ({
        subscribe: async (eventName: string, listener: (message: TestAblyMessage) => void) => {
          operations.push(`subscribe:${channelName}:${eventName}`);
          listenerState.current = listener;
        },
        unsubscribe: (eventName: string, listener: (message: TestAblyMessage) => void) => {
          assert.equal(listener, listenerState.current);
          operations.push(`unsubscribe:${channelName}:${eventName}`);
        },
      }),
    },
    close: () => {
      operations.push("close");
    },
  }));
  const receivedEvents: unknown[] = [];
  const unsubscribe = await subscriber.onMailboxChanged({
    listener: async (event) => {
      receivedEvents.push(event);
    },
    userId: "user-id",
  });

  assert.ok(listenerState.current);
  const emitAblyMessage = listenerState.current;
  emitAblyMessage({
    clientId: "server",
    connectionId: "connection-id",
    data: {
      mailAccountId: "mail-account-id",
      mailboxVersion: "176009",
      type: "mailboxChanged",
    },
    id: "message-id:0",
    name: "mailboxChanged",
    timestamp: 1_783_968_000_000,
  });
  emitAblyMessage({
    data: { type: "unknown" },
    name: "mailboxChanged",
  });
  unsubscribe();

  assert.deepEqual(receivedEvents, [
    {
      mailAccountId: "mail-account-id",
      mailboxVersion: "176009",
      type: "mailboxChanged",
    },
  ]);
  assert.deepEqual(operations, [
    "subscribe:mailbox:user:user-id:mailboxChanged",
    "unsubscribe:mailbox:user:user-id:mailboxChanged",
    "close",
  ]);
});
