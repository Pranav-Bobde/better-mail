import {
  getMailboxRealtimeChannel,
  mailboxChangedEventSchema,
  type MailRealtimeNotifier,
} from "@code-main/api/mail/realtime/contracts";

const mailboxTokenTtlMs = 30 * 60 * 1000;

type AblyChannelPublisher = {
  readonly publish: (eventName: string, data: unknown) => Promise<unknown>;
};

type AblyPublisherClient = {
  readonly channels: {
    readonly get: (channelName: string) => AblyChannelPublisher;
  };
};

type AblyTokenClient = {
  readonly auth: {
    readonly createTokenRequest: (input: {
      readonly capability: string;
      readonly clientId: string;
      readonly ttl: number;
    }) => Promise<unknown>;
  };
};

export function createAblyMailRealtimeNotifier(client: AblyPublisherClient): MailRealtimeNotifier {
  return {
    publishMailboxChanged: async (input) => {
      const event = mailboxChangedEventSchema.parse(input);
      const channel = client.channels.get(getMailboxRealtimeChannel(input.userId));

      await channel.publish(event.type, event);
    },
  };
}

export function createMailboxAblyTokenRequest(client: AblyTokenClient, userId: string) {
  const channelName = getMailboxRealtimeChannel(userId);

  return client.auth.createTokenRequest({
    capability: JSON.stringify({
      [channelName]: ["subscribe"],
    }),
    clientId: userId,
    ttl: mailboxTokenTtlMs,
  });
}

export async function createMailboxRealtimeAuthResponse(
  userId: string | null,
  requestToken: (userId: string) => Promise<unknown>,
) {
  if (!userId) {
    return Response.json({
      error: "UNAUTHENTICATED",
      status: "error",
    });
  }

  return Response.json(await requestToken(userId));
}
