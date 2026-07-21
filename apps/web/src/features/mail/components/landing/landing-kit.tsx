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

export function GoogleCta({
  full = false,
  label = "Continue with Google",
}: {
  full?: boolean;
  label?: string;
}) {
  return (
    <a
      href="/login"
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        full ? "w-full" : ""
      }`}
    >
      <GoogleIcon />
      {label}
    </a>
  );
}

function GoogleIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24">
      <path
        d="M21.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.4a4.7 4.7 0 0 1-2 3.1v2.6h3.3a10 10 0 0 0 2.9-7.7z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.7 0 5-.9 6.7-2.5l-3.3-2.6c-.9.6-2.1 1-3.4 1a6 6 0 0 1-5.7-4.1H2.9v2.7A10 10 0 0 0 12 22z"
        fill="#34A853"
      />
      <path
        d="M6.3 13.8A6.3 6.3 0 0 1 6 12c0-.6.1-1.2.3-1.8V7.5H2.9A10 10 0 0 0 2 12c0 1.6.3 3.1.9 4.5l3.4-2.7z"
        fill="#FBBC05"
      />
      <path
        d="M12 6.1c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.7 9.7 0 0 0 12 2a10 10 0 0 0-9.1 5.5l3.4 2.7A6 6 0 0 1 12 6.1z"
        fill="#EA4335"
      />
    </svg>
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
