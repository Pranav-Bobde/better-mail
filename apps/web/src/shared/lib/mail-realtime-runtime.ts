import { env } from "@code-main/env/server";
import { Rest } from "ably";

import {
  createAblyMailRealtimeNotifier,
  createMailboxAblyTokenRequest,
} from "@/shared/lib/mail-realtime-server";

const ablyRest = new Rest({
  key: env.ABLY_API_KEY,
});

export const ablyMailRealtimeNotifier = createAblyMailRealtimeNotifier(ablyRest);

export function createMailboxRealtimeTokenRequest(userId: string) {
  return createMailboxAblyTokenRequest(ablyRest, userId);
}
