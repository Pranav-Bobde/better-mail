import { ORPCError, os } from "@orpc/server";
import { evlog } from "evlog/orpc";

import type { Context } from "./context";

export const o = os.$context<Context>();

export const publicProcedure = o.use(evlog<Context>());

const requireAuth = o.middleware(async ({ context, next }) => {
  if (!context.session) {
    throw new ORPCError("UNAUTHORIZED");
  }
  return next({
    context: {
      session: context.session,
    },
  });
});

export const protectedProcedure = publicProcedure.use(requireAuth);
