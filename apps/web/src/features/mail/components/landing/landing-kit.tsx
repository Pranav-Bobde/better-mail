/*
 * Shared primitives for the marketing landing page. Derived from the product
 * design system (DESIGN.md): near-black canvas, Geist, hairline borders,
 * 0.5rem radius, and a single restrained accent — the product's unread-dot blue.
 */

import Link from "next/link";
import * as React from "react";

import { MailMark } from "@/shared/components/mail-mark";

/* The one chromatic hit across the page — the app's unread-dot blue. */
export const ACCENT = "#3b82f6";

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`group inline-flex items-center gap-2 text-foreground ${className}`}>
      <MailMark size={24} />
      <span className="text-sm font-semibold tracking-tight">Mail</span>
    </Link>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[11px] font-medium text-muted-foreground">
      {children}
    </kbd>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
      <span className="h-px w-6" style={{ backgroundColor: ACCENT }} />
      {children}
    </span>
  );
}

export function BrowserFrame({
  url = "app.mail.new",
  children,
  className = "",
}: {
  url?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-lg border border-border bg-background shadow-2xl shadow-black/40 ${className}`}
    >
      <div className="flex h-9 items-center gap-2 border-b border-border bg-muted/40 px-3">
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
        </div>
        <div className="mx-auto flex h-5 w-full max-w-xs items-center justify-center rounded border border-border bg-background/60 font-mono text-[10px] text-muted-foreground">
          {url}
        </div>
      </div>
      {children}
    </div>
  );
}
