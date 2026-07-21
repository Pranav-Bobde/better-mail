import { z } from "zod";

export const waitlistJoinInputSchema = z.object({
  email: z.email(),
  source: z.string().max(80).optional(),
  // Honeypot: a hidden field real users never fill. Bots do.
  hp: z.string().max(200).optional(),
});

export const waitlistJoinOutputSchema = z.discriminatedUnion("status", [
  z.object({
    data: z.object({
      position: z.number().int().nonnegative(),
      alreadyJoined: z.boolean(),
    }),
    status: z.literal("ok"),
  }),
  z.object({
    error: z.string(),
    status: z.literal("error"),
  }),
]);
