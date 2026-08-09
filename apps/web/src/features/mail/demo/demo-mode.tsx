"use client";

import * as React from "react";

import { orpc } from "@/shared/utils/orpc";

// The public demo renders the real mail UI against in-browser fixture data, so
// every mail.* query/mutation has to resolve against the demo client instead of
// the RPC API. Query *keys* stay on the real `orpc` everywhere: they are
// path-derived and identical for both clients, so the existing optimistic cache
// writes and invalidations keep working untouched in both modes.
export type MailRpcUtils = typeof orpc.mail;

// The context carries the demo utils *value*, not a boolean flag, so this
// module never imports the demo client and the fixture mailbox stays out of the
// real app's bundle. `demo-provider` is the only module that supplies a value,
// and mail.tsx loads it lazily and only in demo mode. Typing the value as
// MailRpcUtils is also what proves the demo client is interchangeable with the
// real one (no `as`, and call sites see one shape instead of a union).
const DemoMailRpcContext = React.createContext<MailRpcUtils | null>(null);

export function DemoMailRpcProvider({
  children,
  mailRpc,
}: {
  readonly children: React.ReactNode;
  readonly mailRpc: MailRpcUtils;
}) {
  return <DemoMailRpcContext.Provider value={mailRpc}>{children}</DemoMailRpcContext.Provider>;
}

export function useIsDemoMode() {
  return React.useContext(DemoMailRpcContext) !== null;
}

export function useMailRpc() {
  return React.useContext(DemoMailRpcContext) ?? orpc.mail;
}
