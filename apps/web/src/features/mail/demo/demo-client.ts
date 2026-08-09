import type { AppRouterClient } from "@code-main/api/routers/index";
import {
  archiveThreadInputSchema,
  createDraftInputSchema,
  deleteDraftInputSchema,
  getMailboxInputSchema,
  getThreadInputSchema,
  listDraftsInputSchema,
  sendMailInputSchema,
  setThreadReadInputSchema,
  updateDraftInputSchema,
} from "@code-main/api/mail/contracts";

import {
  archiveDemoThread,
  createDemoDraft,
  deleteDemoDraft,
  markDemoThreadRead,
  sendDemoMessage,
  updateDemoDraft,
} from "@/features/mail/demo/demo-mailbox-mutations";
import {
  selectDemoMailboxData,
  selectDemoThreadMessages,
} from "@/features/mail/demo/demo-mailbox-state";
import { getDemoMailboxState, setDemoMailboxState } from "@/features/mail/demo/demo-store";

const draftNotFoundError = "That draft is no longer available in the demo mailbox.";

// Annotated rather than `satisfies` on purpose: the annotation is what pins
// each method to the router's client-context and envelope types, so the demo
// client and the real RPC client stay interchangeable for the mail UI.
export const demoMailClient: AppRouterClient["mail"] = {
  archiveThread: async (input) => {
    setDemoMailboxState(archiveDemoThread(getDemoMailboxState(), input));

    return {
      data: {
        cacheApplied: true,
        threadId: input.threadId,
      },
      status: "ok",
    };
  },

  createDraft: async (input) => {
    const result = createDemoDraft(getDemoMailboxState(), input, new Date().toISOString());
    setDemoMailboxState(result.state);

    return {
      data: {
        cacheApplied: true,
        draftId: result.draft.draftId,
        messageId: result.draft.messageId,
        threadId: result.draft.threadId,
      },
      status: "ok",
    };
  },

  deleteDraft: async (input) => {
    const result = deleteDemoDraft(getDemoMailboxState(), input);
    setDemoMailboxState(result.state);

    return {
      data: {
        cacheApplied: true,
        draftId: input.draftId,
        threadId: result.threadId,
      },
      status: "ok",
    };
  },

  getMailbox: async (input) => ({
    data: selectDemoMailboxData(getDemoMailboxState(), {
      folder: input.folder ?? "inbox",
      query: input.query,
      view: input.view,
    }),
    status: "ok",
  }),

  getThread: async (input) => ({
    data: {
      messages: selectDemoThreadMessages(getDemoMailboxState(), input.threadId),
    },
    status: "ok",
  }),

  listDrafts: async () => ({
    data: {
      drafts: [...getDemoMailboxState().drafts],
    },
    status: "ok",
  }),

  send: async (input) => {
    const result = sendDemoMessage(getDemoMailboxState(), input, new Date().toISOString());
    setDemoMailboxState(result.state);

    return {
      data: {
        cacheApplied: true,
        messageId: result.messageId,
        threadId: result.threadId,
      },
      status: "ok",
    };
  },

  setThreadRead: async (input) => {
    setDemoMailboxState(markDemoThreadRead(getDemoMailboxState(), input));

    return {
      data: {
        cacheApplied: true,
        read: input.read,
        threadId: input.threadId,
      },
      status: "ok",
    };
  },

  updateDraft: async (input) => {
    const result = updateDemoDraft(getDemoMailboxState(), input, new Date().toISOString());

    if (result.found === false) {
      return {
        error: draftNotFoundError,
        status: "error",
      };
    }

    setDemoMailboxState(result.state);

    return {
      data: {
        cacheApplied: true,
        draftId: result.draft.draftId,
        messageId: result.draft.messageId,
        threadId: result.draft.threadId,
      },
      status: "ok",
    };
  },
};

// The custom demo link receives `unknown` input, so this is the demo's RPC
// boundary: each procedure parses with its contract schema before dispatch,
// exactly like the server-side handlers do.
const demoMailProcedureRoutes = new Map<string, (input: unknown) => Promise<unknown>>([
  ["archiveThread", (input) => demoMailClient.archiveThread(archiveThreadInputSchema.parse(input))],
  ["createDraft", (input) => demoMailClient.createDraft(createDraftInputSchema.parse(input))],
  ["deleteDraft", (input) => demoMailClient.deleteDraft(deleteDraftInputSchema.parse(input))],
  ["getMailbox", (input) => demoMailClient.getMailbox(getMailboxInputSchema.parse(input))],
  ["getThread", (input) => demoMailClient.getThread(getThreadInputSchema.parse(input))],
  ["listDrafts", (input) => demoMailClient.listDrafts(listDraftsInputSchema.parse(input))],
  ["send", (input) => demoMailClient.send(sendMailInputSchema.parse(input))],
  ["setThreadRead", (input) => demoMailClient.setThreadRead(setThreadReadInputSchema.parse(input))],
  ["updateDraft", (input) => demoMailClient.updateDraft(updateDraftInputSchema.parse(input))],
]);

export function callDemoMailProcedure(method: string, input: unknown) {
  const callProcedure = demoMailProcedureRoutes.get(method);

  return callProcedure === undefined
    ? Promise.reject(new Error(`Demo client does not implement mail.${method}`))
    : callProcedure(input);
}
