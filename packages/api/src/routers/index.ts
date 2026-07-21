import type { RouterClient } from "@orpc/server";

import {
  getMailboxInputSchema,
  getMailboxOutputSchema,
} from "../functions/mail/getMailbox/constants";
import { runGetMailbox } from "../functions/mail/getMailbox/run";
import { getThreadInputSchema, getThreadOutputSchema } from "../functions/mail/getThread/constants";
import { runGetThread } from "../functions/mail/getThread/run";
import { sendMailInputSchema, sendMailOutputSchema } from "../functions/mail/send/constants";
import { runSendMail } from "../functions/mail/send/run";
import {
  waitlistJoinInputSchema,
  waitlistJoinOutputSchema,
} from "../functions/waitlist/join/constants";
import { runJoinWaitlist } from "../functions/waitlist/join/run";
import { createRpcSuccessFields } from "../observability/rpc/fields";
import { publicProcedure } from "../index";

export const appRouter = {
  healthCheck: publicProcedure.handler(({ context }) => {
    context.log.set({
      ...createRpcSuccessFields("healthCheck"),
      health: {
        status: "ok",
      },
    });

    return {
      status: "ok",
      data: {
        health: "ok",
      },
    };
  }),
  mail: {
    getMailbox: publicProcedure
      .input(getMailboxInputSchema)
      .output(getMailboxOutputSchema)
      .handler(({ input, context }) => runGetMailbox(input, context)),
    getThread: publicProcedure
      .input(getThreadInputSchema)
      .output(getThreadOutputSchema)
      .handler(({ input, context }) => runGetThread(input, context)),
    send: publicProcedure
      .input(sendMailInputSchema)
      .output(sendMailOutputSchema)
      .handler(({ input, context }) => runSendMail(input, context)),
  },
  waitlist: {
    join: publicProcedure
      .input(waitlistJoinInputSchema)
      .output(waitlistJoinOutputSchema)
      .handler(({ input, context }) => runJoinWaitlist(input, context)),
  },
};
export type AppRouterClient = RouterClient<typeof appRouter>;
