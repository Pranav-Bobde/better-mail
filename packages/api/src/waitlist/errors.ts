import { defineErrorCatalog } from "evlog";

export const waitlistErrors = defineErrorCatalog("waitlist", {
  DISPOSABLE_EMAIL: {
    status: 200,
    message: "Please use a permanent email address",
    why: "The submitted email failed validation or is a known disposable/throwaway address",
    fix: "Enter a real, non-disposable email and retry",
    internal: {
      dependency: "mailchecker",
      dependencyOperation: "isValid",
      module: "waitlist",
    },
  },
  RATE_LIMITED: {
    status: 200,
    message: "Too many attempts — try again in a bit",
    why: "This client submitted too many waitlist joins within the rate-limit window",
    fix: "Wait a few minutes before submitting again",
    internal: {
      dependency: "db",
      dependencyOperation: "waitlistEntry.count",
      module: "waitlist",
    },
  },
  JOIN_FAILED: {
    status: 200,
    message: "Could not join the waitlist",
    why: "An unexpected error occurred while writing the waitlist entry",
    fix: "Retry shortly; if it persists check the database connection",
    internal: {
      dependency: "db",
      dependencyOperation: "waitlistEntry.upsert",
      module: "waitlist",
    },
  },
} as const);

declare module "evlog" {
  interface RegisteredErrorCatalogs {
    waitlist: typeof waitlistErrors;
  }
}
