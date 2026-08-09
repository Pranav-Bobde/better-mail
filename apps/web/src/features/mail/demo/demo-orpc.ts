import type { ClientLink } from "@orpc/client";
import { createORPCClient } from "@orpc/client";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";

import type { AppRouterClient } from "@code-main/api/routers/index";

import { callDemoMailProcedure } from "@/features/mail/demo/demo-client";

// The demo methods are served through a real oRPC client proxy rather than
// handed to the TanStack utils as a plain object. This is load-bearing, not
// cosmetic: utils built over a plain object produce query options that wedge
// React's navigation transitions into a render that never commits (folder
// navigation hangs on an empty list). The proxy from createORPCClient — the
// same factory the production client uses — does not.
const demoLink: ClientLink<Record<never, never>> = {
  call: (path, input) => {
    const [namespace, method] = path;

    if (namespace !== "mail" || method === undefined) {
      return Promise.reject(new Error(`Demo client does not implement ${path.join(".")}`));
    }

    return callDemoMailProcedure(method, input);
  },
};

const demoClient: Pick<AppRouterClient, "mail"> = {
  mail: createORPCClient<AppRouterClient>(demoLink).mail,
};

// Query keys are derived from the router path, so mounting the demo client
// under the same `mail` key makes demoOrpc.mail.*.key() identical to
// orpc.mail.*.key() and the mail UI can swap one utils object for the other.
export const demoOrpc = createTanstackQueryUtils(demoClient);
