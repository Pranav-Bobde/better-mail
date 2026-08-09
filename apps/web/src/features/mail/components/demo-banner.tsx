"use client";

// Client boundary: Badge renders through base-ui's `useRender`, so it cannot be
// called from the server component that mounts this banner.

import Link from "next/link";

import { Badge } from "@code-main/ui/components/badge";

// A UrlObject keeps the href valid under Next's typedRoutes without a cast, and
// carries the hash to the landing page's waitlist section.
export const demoWaitlistHref = {
  hash: "waitlist",
  pathname: "/",
} satisfies React.ComponentProps<typeof Link>["href"];

// Slim, non-blocking strip above the workspace. Deliberately a single bordered
// row in the product token system (DESIGN.md) rather than a marketing band.
export function DemoBanner() {
  return (
    <div className="flex h-9 shrink-0 items-center gap-3 border-b border-border bg-muted/30 px-4">
      <Badge variant="secondary">Demo</Badge>
      <p className="truncate text-xs text-muted-foreground">Demo mailbox — nothing here is real.</p>
      <Link
        className="ml-auto text-xs font-medium text-foreground underline-offset-4 hover:underline"
        href={demoWaitlistHref}
      >
        Join the waitlist
      </Link>
    </div>
  );
}
