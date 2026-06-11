import type { AppRouterClient } from "@code-main/api/routers/index";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type ApiEnvelope =
  | {
      readonly status: "ok";
      readonly data: unknown;
    }
  | {
      readonly status: "error";
      readonly error: string;
    };

declare module "@tanstack/react-query" {
  interface Register {
    queryMeta: {
      readonly silentError?: boolean;
    };
  }
}

function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (query.meta?.silentError) {
          return;
        }

        toast.error(`Error: ${error.message}`, {
          action: {
            label: "retry",
            onClick: () => {
              query.invalidate();
            },
          },
        });
      },
    }),
  });
}

export const queryClient = createQueryClient();

const link = new RPCLink({
  url: `${getRpcBaseUrl()}/api/rpc`,
  async fetch(url, options) {
    const response = await fetch(url, {
      ...options,
      credentials: "include",
    });

    const envelope = await readJsonEnvelope(response);
    if (envelope?.status === "error") {
      throw new Error(envelope.error);
    }

    return response;
  },
  headers: async () => {
    if (typeof window !== "undefined") {
      return {};
    }

    const { headers } = await import("next/headers");
    return Object.fromEntries(await headers());
  },
});

const client: AppRouterClient = createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);

function getRpcBaseUrl() {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  const appUrl = process.env.APP_URL;

  if (!appUrl) {
    throw new Error("APP_URL is required for server-side RPC calls");
  }

  return appUrl;
}

async function readJsonEnvelope(response: Response): Promise<ApiEnvelope | null> {
  const contentType = response.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    return null;
  }

  const body = await response.clone().json();
  if (!isApiEnvelope(body)) {
    return null;
  }

  return body;
}

function isApiEnvelope(value: unknown): value is ApiEnvelope {
  if (!isRecord(value)) {
    return false;
  }

  return value.status === "ok" || (value.status === "error" && typeof value.error === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
