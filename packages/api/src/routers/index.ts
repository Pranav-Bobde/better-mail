import type { RouterClient } from "@orpc/server";
import type { RpcRequestTrigger } from "../observability/rpc/request-diagnostics";

import {
  archiveThreadInputSchema,
  archiveThreadOutputSchema,
} from "../functions/mail/archiveThread/constants";
import { runArchiveThread } from "../functions/mail/archiveThread/run";
import {
  createDraftInputSchema,
  createDraftOutputSchema,
} from "../functions/mail/createDraft/constants";
import { runCreateDraft } from "../functions/mail/createDraft/run";
import {
  deleteDraftInputSchema,
  deleteDraftOutputSchema,
} from "../functions/mail/deleteDraft/constants";
import { runDeleteDraft } from "../functions/mail/deleteDraft/run";
import {
  getMailboxInputSchema,
  getMailboxOutputSchema,
} from "../functions/mail/getMailbox/constants";
import { runGetMailbox } from "../functions/mail/getMailbox/run";
import { getThreadInputSchema, getThreadOutputSchema } from "../functions/mail/getThread/constants";
import { runGetThread } from "../functions/mail/getThread/run";
import {
  listDraftsInputSchema,
  listDraftsOutputSchema,
} from "../functions/mail/listDrafts/constants";
import { runListDrafts } from "../functions/mail/listDrafts/run";
import { sendMailInputSchema, sendMailOutputSchema } from "../functions/mail/send/constants";
import { runSendMail } from "../functions/mail/send/run";
import {
  setThreadReadInputSchema,
  setThreadReadOutputSchema,
} from "../functions/mail/setThreadRead/constants";
import { runSetThreadRead } from "../functions/mail/setThreadRead/run";
import {
  updateDraftInputSchema,
  updateDraftOutputSchema,
} from "../functions/mail/updateDraft/constants";
import { runUpdateDraft } from "../functions/mail/updateDraft/run";
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
    archiveThread: publicProcedure
      .input(archiveThreadInputSchema)
      .output(archiveThreadOutputSchema)
      .handler(({ input, context }) => runArchiveThread(input, context)),
    createDraft: publicProcedure
      .input(createDraftInputSchema)
      .output(createDraftOutputSchema)
      .handler(({ input, context }) => runCreateDraft(input, context)),
    deleteDraft: publicProcedure
      .input(deleteDraftInputSchema)
      .output(deleteDraftOutputSchema)
      .handler(({ input, context }) => runDeleteDraft(input, context)),
    getMailbox: publicProcedure
      .input(getMailboxInputSchema)
      .output(getMailboxOutputSchema)
      .handler(({ input, context }) => runGetMailbox(input, context)),
    getThread: publicProcedure
      .input(getThreadInputSchema)
      .output(getThreadOutputSchema)
      .handler(({ input, context }) => runGetThread(input, context)),
    listDrafts: publicProcedure
      .input(listDraftsInputSchema)
      .output(listDraftsOutputSchema)
      .handler(({ context }) => runListDrafts(context)),
    send: publicProcedure
      .input(sendMailInputSchema)
      .output(sendMailOutputSchema)
      .handler(({ input, context }) => runSendMail(input, context)),
    setThreadRead: publicProcedure
      .input(setThreadReadInputSchema)
      .output(setThreadReadOutputSchema)
      .handler(({ input, context }) => runSetThreadRead(input, context)),
    updateDraft: publicProcedure
      .input(updateDraftInputSchema)
      .output(updateDraftOutputSchema)
      .handler(({ input, context }) => runUpdateDraft(input, context)),
  },
  waitlist: {
    join: publicProcedure
      .input(waitlistJoinInputSchema)
      .output(waitlistJoinOutputSchema)
      .handler(({ input, context }) => runJoinWaitlist(input, context)),
  },
};
export type RpcClientContext = {
  readonly requestTrigger?: RpcRequestTrigger;
};

export type AppRouterClient = RouterClient<typeof appRouter, RpcClientContext>;
