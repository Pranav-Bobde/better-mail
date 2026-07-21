"use client";

/*
 * Shared helpers + UI primitives for the waitlist form on the landing page.
 */

import { ArrowRight, Check, Loader2 } from "lucide-react";

import { ACCENT } from "@/features/mail/components/landing/landing-kit";

export { ACCENT };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmail(value: string) {
  return EMAIL_RE.test(value.trim());
}

export function fmt(n: number) {
  return n.toLocaleString("en-US");
}

export type WaitlistStatus = "idle" | "submitting" | "success" | "exists";

/* ── Small shared UI ──────────────────────────────────────── */

function Spinner({ className = "size-4" }: { className?: string }) {
  return <Loader2 className={`${className} animate-spin`} />;
}

export function CheckBadge({ size = 44 }: { size?: number }) {
  return (
    <span
      className="grid place-items-center rounded-full"
      style={{
        width: size,
        height: size,
        background: `color-mix(in oklab, ${ACCENT} 16%, transparent)`,
        border: `1px solid ${ACCENT}`,
      }}
    >
      <Check className="size-5" style={{ color: ACCENT }} strokeWidth={2.5} />
    </span>
  );
}

export function SubmitArrow({ label, status }: { label: string; status: WaitlistStatus }) {
  if (status === "submitting") {
    return (
      <>
        <Spinner /> Joining…
      </>
    );
  }
  return (
    <>
      {label} <ArrowRight className="size-4" />
    </>
  );
}

function XLogo() {
  return (
    <svg viewBox="0 0 24 24" className="size-3" fill="currentColor" aria-hidden>
      <path d="M18.9 1.2h3.7l-8 9.1 9.4 12.4h-7.4l-5.8-7.6-6.6 7.6H.5l8.5-9.8L0 1.2h7.6l5.2 6.9zM17.6 20.5h2L6.5 3.2h-2.2z" />
    </svg>
  );
}

export function ShareX({ label = "Share on X" }: { label?: string }) {
  const href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    "Just joined the waitlist for Mail — an AI email client. Grab a seat:",
  )}&url=${encodeURIComponent("https://mail.new")}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-xs font-medium transition-opacity hover:opacity-80"
      style={{ color: ACCENT }}
    >
      <XLogo /> {label}
    </a>
  );
}
