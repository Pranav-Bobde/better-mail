import { z } from "zod";

export const mailboxChangedEventSchema = z.object({
  mailAccountId: z.string().min(1),
  mailboxVersion: z.string().min(1),
  type: z.literal("mailboxChanged"),
});

export type MailboxChangedEvent = z.infer<typeof mailboxChangedEventSchema>;

export type MailRealtimeNotifier = {
  readonly publishMailboxChanged: (
    event: MailboxChangedEvent & { readonly userId: string },
  ) => Promise<void>;
};

export function getMailboxRealtimeChannel(userId: string) {
  return `mailbox:user:${encodeURIComponent(userId)}`;
}
