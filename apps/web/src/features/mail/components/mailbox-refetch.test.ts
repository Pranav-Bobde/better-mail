import assert from "node:assert/strict";
import test from "node:test";

import { RPCHandler } from "@orpc/server/fetch";
import { os } from "@orpc/server";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { z } from "zod";

import { getMailboxInputSchema } from "@code-main/api/mail/contracts";

const rpcWireRequestSchema = z.object({
  json: getMailboxInputSchema,
});

const rpcHandler = new RPCHandler({
  mail: {
    getMailbox: os.input(getMailboxInputSchema).handler(({ input }) => ({
      data: input,
      status: "ok",
    })),
  },
});

const emptyMailbox = {
  data: {
    account: {
      email: "mailbox-test@example.com",
      label: "Mailbox Test",
    },
    counts: {
      drafts: 0,
      inboxUnread: 0,
    },
    messages: [],
    source: "gmail" as const,
  },
  status: "ok" as const,
};

test("concurrent manual refresh and search keep their own input and trigger context", async () => {
  const harness = await createRpcHarness();
  const queryClient = new QueryClient();
  const manualResponseGate = createGate();
  const manualRequestStarted = createGate();
  harness.setBeforeResponse(async (request) => {
    if (request.input.query === "") {
      manualRequestStarted.open();
      await manualResponseGate.wait;
    }
  });

  try {
    const manualRefresh = harness.refetchMailboxQuery(
      queryClient,
      { folder: "inbox", searchQuery: "", view: "all" },
      "mailbox.refresh",
    );
    await manualRequestStarted.wait;

    const search = harness.refetchMailboxQuery(
      queryClient,
      { folder: "inbox", searchQuery: "project", view: "all" },
      "mailbox.search",
    );
    await search;
    manualResponseGate.open();
    await manualRefresh;

    assert.deepEqual(
      harness.requests.map((request) => ({
        query: request.input.query,
        trigger: request.trigger,
      })),
      [
        { query: "", trigger: "mailbox.refresh" },
        { query: "project", trigger: "mailbox.search" },
      ],
    );
    assert.notEqual(harness.requests[0]?.clientRequestId, harness.requests[1]?.clientRequestId);
  } finally {
    manualResponseGate.open();
    queryClient.clear();
    harness.restore();
  }
});

test("realtime refetch fetches active mailbox only and leaves inactive mailbox stale", async () => {
  const harness = await createRpcHarness();
  const queryClient = new QueryClient();
  const { createMailboxQueryOptions } =
    await import("@/features/mail/components/mailbox-query-options");
  const { orpc } = await import("@/shared/utils/orpc");
  const activeOptions = orpc.mail.getMailbox.queryOptions(
    createMailboxQueryOptions({ folder: "inbox", searchQuery: "active", view: "all" }),
  );
  const inactiveOptions = orpc.mail.getMailbox.queryOptions(
    createMailboxQueryOptions({ folder: "sent", searchQuery: "inactive", view: "all" }),
  );
  queryClient.setQueryData(activeOptions.queryKey, emptyMailbox);
  queryClient.setQueryData(inactiveOptions.queryKey, emptyMailbox);
  const observer = new QueryObserver(queryClient, {
    queryFn: async () => emptyMailbox,
    queryKey: activeOptions.queryKey,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const unsubscribe = observer.subscribe(() => undefined);

  try {
    await harness.refetchActiveMailboxQueries(queryClient, "mailbox.realtime");

    assert.deepEqual(
      harness.requests.map((request) => ({
        folder: request.input.folder,
        query: request.input.query,
        trigger: request.trigger,
      })),
      [{ folder: "inbox", query: "active", trigger: "mailbox.realtime" }],
    );
    assert.equal(queryClient.getQueryState(inactiveOptions.queryKey)?.isInvalidated, true);
  } finally {
    unsubscribe();
    queryClient.clear();
    harness.restore();
  }
});

async function createRpcHarness() {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: {
        origin: "http://localhost:4000",
      },
    },
  });
  const originalFetch = globalThis.fetch;
  const requests: {
    readonly clientRequestId: string;
    readonly input: z.infer<typeof getMailboxInputSchema>;
    readonly trigger: string;
  }[] = [];
  let beforeResponse = async (_request: (typeof requests)[number]) => undefined;

  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const parsedBody = rpcWireRequestSchema.parse(await request.clone().json());
    const capturedRequest = {
      clientRequestId: request.headers.get("x-better-mail-client-request-id") ?? "",
      input: parsedBody.json,
      trigger: request.headers.get("x-better-mail-request-trigger") ?? "",
    };
    requests.push(capturedRequest);

    const result = await rpcHandler.handle(request, {
      context: {},
      prefix: "/api/rpc",
    });
    assert.ok(result.response);
    await beforeResponse(capturedRequest);
    return result.response;
  };

  const { refetchActiveMailboxQueries, refetchMailboxQuery } =
    await import("@/features/mail/components/mailbox-refetch");

  return {
    refetchActiveMailboxQueries,
    refetchMailboxQuery,
    requests,
    restore() {
      globalThis.fetch = originalFetch;
    },
    setBeforeResponse(nextBeforeResponse: typeof beforeResponse) {
      beforeResponse = nextBeforeResponse;
    },
  };
}

function createGate() {
  const gateOpeners: (() => void)[] = [];
  const wait = new Promise<void>((resolve) => {
    gateOpeners.push(resolve);
  });

  return {
    open() {
      gateOpeners[0]?.();
    },
    wait,
  };
}
