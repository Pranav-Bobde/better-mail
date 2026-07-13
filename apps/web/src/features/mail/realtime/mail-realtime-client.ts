import {
  getMailboxRealtimeChannel,
  mailboxChangedEventSchema,
  type MailboxChangedEvent,
} from "@code-main/api/mail/realtime/contracts";
import { Realtime } from "ably";

type AblyMessage = {
  readonly data?: unknown;
  readonly name?: string;
};

type AblyRealtimeChannel = {
  readonly subscribe: (
    eventName: string,
    listener: (message: AblyMessage) => void,
  ) => Promise<unknown>;
  readonly unsubscribe: (eventName: string, listener: (message: AblyMessage) => void) => void;
};

type AblyRealtimeClient = {
  readonly channels: {
    readonly get: (channelName: string) => AblyRealtimeChannel;
  };
  readonly close: () => void;
};

export type MailRealtimeSubscriber = {
  readonly onMailboxChanged: (input: {
    readonly listener: (event: MailboxChangedEvent) => Promise<void>;
    readonly userId: string;
  }) => Promise<() => void>;
};

export function createAblyMailRealtimeSubscriber(
  createClient: () => AblyRealtimeClient,
): MailRealtimeSubscriber {
  return {
    onMailboxChanged: async (input) => {
      const client = createClient();
      const channel = client.channels.get(getMailboxRealtimeChannel(input.userId));
      const listener = (message: AblyMessage) => {
        if (message.name !== "mailboxChanged") {
          return;
        }

        const event = mailboxChangedEventSchema.safeParse(message.data);
        if (!event.success) {
          return;
        }

        void input.listener(event.data);
      };

      try {
        await channel.subscribe("mailboxChanged", listener);
      } catch (error) {
        client.close();
        throw error;
      }

      return () => {
        channel.unsubscribe("mailboxChanged", listener);
        client.close();
      };
    },
  };
}

export const ablyMailRealtimeSubscriber = createAblyMailRealtimeSubscriber(
  () =>
    new Realtime({
      authMethod: "POST",
      authUrl: "/api/realtime/auth",
    }),
);
