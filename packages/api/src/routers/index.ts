import type { RouterClient } from "@orpc/server";

import {
  getMailboxInputSchema,
  getMailboxOutputSchema,
} from "../functions/mail/getMailbox/constants";
import { runGetMailbox } from "../functions/mail/getMailbox/run";
import { sendMailInputSchema, sendMailOutputSchema } from "../functions/mail/send/constants";
import { runSendMail } from "../functions/mail/send/run";
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
    send: publicProcedure
      .input(sendMailInputSchema)
      .output(sendMailOutputSchema)
      .handler(({ input, context }) => runSendMail(input, context)),
  },
};
export type AppRouterClient = RouterClient<typeof appRouter>;
