"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";

import { DemoMailRpcProvider } from "@/features/mail/demo/demo-mode";
import { demoOrpc } from "@/features/mail/demo/demo-orpc";
import { createQueryClient } from "@/shared/utils/orpc";

// The single entry point into the demo client, and therefore the only module
// that pulls the fixture mailbox into a bundle. mail.tsx loads it through
// next/dynamic behind `demoMode`, so a real visitor never downloads the
// fixtures; everything below this component is the unmodified mail UI.
//
// The demo gets its own QueryClient: demo and real mail share query keys by
// design, so caching fixture data in the app-wide client would let a
// client-side navigation show demo threads in a signed-in mailbox — or cached
// real mail inside the demo, where the unauthenticated AI endpoint could read
// it from runtime context. An isolated cache closes both directions.
export function DemoProvider({ children }: { readonly children: React.ReactNode }) {
  const [demoQueryClient] = React.useState(createQueryClient);

  return (
    <QueryClientProvider client={demoQueryClient}>
      <DemoMailRpcProvider mailRpc={demoOrpc.mail}>{children}</DemoMailRpcProvider>
    </QueryClientProvider>
  );
}
