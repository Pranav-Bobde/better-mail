import type { RouterClient } from "@orpc/server";

import { createRpcSuccessFields } from "../observability/rpc/fields";
import { publicProcedure } from "../index";

export const appRouter = {
  healthCheck: publicProcedure.handler(({ context }) => {
    context.log?.set({
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
};
export type AppRouterClient = RouterClient<typeof appRouter>;
