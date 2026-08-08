import { getAuthorizedSession } from "@code-main/auth";
import { createMailCopilotRuntimeHandler } from "@code-main/api/ai/mail-copilot-runtime";

import { withSessionAuth } from "@/shared/lib/request-auth";

const handleMailCopilotRuntime = createMailCopilotRuntimeHandler();

export const POST = withSessionAuth(handleMailCopilotRuntime, getAuthorizedSession);
