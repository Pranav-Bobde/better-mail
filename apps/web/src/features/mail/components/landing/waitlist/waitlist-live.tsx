"use client";

import { useMutation } from "@tanstack/react-query";
import * as React from "react";

import { orpc } from "@/shared/utils/orpc";

import {
  ACCENT,
  CheckBadge,
  fmt,
  isEmail,
  ShareX,
  SubmitArrow,
  type WaitlistStatus,
} from "@/features/mail/components/landing/waitlist/waitlist-core";

function messageForCode(code: string) {
  const c = code.toLowerCase();
  if (c.includes("disposable")) return "Please use a permanent (non-disposable) email.";
  if (c.includes("rate")) return "Too many attempts — try again in a few minutes.";
  return "Something went wrong. Please try again.";
}

type JoinOutcome =
  | { kind: "joined"; position: number; alreadyJoined: boolean }
  | { kind: "failed"; message: string };

/* Real, backend-wired waitlist join (orpc.waitlist.join). */
function useWaitlistJoin(source?: string) {
  const [email, setEmail] = React.useState("");
  const [hp, setHp] = React.useState("");
  const [status, setStatus] = React.useState<WaitlistStatus>("idle");
  const [error, setError] = React.useState("");
  const [position, setPosition] = React.useState(0);
  const join = useMutation(orpc.waitlist.join.mutationOptions());

  const requestJoin = async (value: string): Promise<JoinOutcome> => {
    try {
      const res = await join.mutateAsync({ email: value, source, hp });
      if (res.status === "ok") {
        return {
          kind: "joined",
          position: res.data.position,
          alreadyJoined: res.data.alreadyJoined,
        };
      }
      return { kind: "failed", message: messageForCode(res.error) };
    } catch (err) {
      return { kind: "failed", message: messageForCode(err instanceof Error ? err.message : "") };
    }
  };

  const applyOutcome = (outcome: JoinOutcome) => {
    if (outcome.kind === "failed") {
      setStatus("idle");
      setError(outcome.message);
      return;
    }
    setPosition(outcome.position);
    setStatus(outcome.alreadyJoined ? "exists" : "success");
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (status === "submitting") return;
    const value = email.trim();
    if (!isEmail(value)) {
      setError("Enter a valid email address.");
      return;
    }
    setError("");
    setStatus("submitting");
    applyOutcome(await requestJoin(value));
  };

  const reset = () => {
    setStatus("idle");
    setEmail("");
    setError("");
    setHp("");
  };

  return { email, setEmail, hp, setHp, status, error, position, submit, reset };
}

/* A1 success state: joined confirmation with position, share, and reset. */
function JoinedNotice({
  status,
  position,
  email,
  onReset,
}: {
  status: WaitlistStatus;
  position: number;
  email: string;
  onReset: () => void;
}) {
  return (
    <div
      className="mx-auto flex max-w-md items-start gap-3 rounded-lg border p-4 text-left"
      style={{
        borderColor: ACCENT,
        background: `color-mix(in oklab, ${ACCENT} 7%, transparent)`,
      }}
    >
      <CheckBadge size={38} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          {status === "exists" ? "You're already on the list." : "You're on the list!"}{" "}
          <span style={{ color: ACCENT }}>#{fmt(position)}</span>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          We&rsquo;ll email <span className="text-foreground">{email.trim()}</span> the moment your
          seat opens.
        </p>
        <div className="mt-2.5 flex items-center gap-4">
          <ShareX />
          <button
            type="button"
            onClick={onReset}
            className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Use a different email
          </button>
        </div>
      </div>
    </div>
  );
}

function FormHint({ error }: { error: string }) {
  if (error) {
    return (
      <p className="mt-2 text-left text-xs" style={{ color: "hsl(0 72% 62%)" }}>
        {error}
      </p>
    );
  }
  return (
    <p className="mt-2.5 text-xs text-muted-foreground">
      No spam — one email when your seat is ready.
    </p>
  );
}

export function WaitlistForm({ source = "landing-hero" }: { source?: string }) {
  const wl = useWaitlistJoin(source);
  const done = wl.status === "success" || wl.status === "exists";

  if (done) {
    return (
      <JoinedNotice status={wl.status} position={wl.position} email={wl.email} onReset={wl.reset} />
    );
  }

  return (
    <form onSubmit={wl.submit} noValidate className="mx-auto max-w-md">
      {/* Honeypot: off-screen, never shown to humans; bots that fill it are dropped. */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={wl.hp}
        onChange={(e) => wl.setHp(e.target.value)}
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
      />
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          value={wl.email}
          onChange={(e) => wl.setEmail(e.target.value)}
          placeholder="you@work.com"
          aria-label="Email address"
          aria-invalid={Boolean(wl.error)}
          className="h-11 flex-1 rounded-md border bg-background px-3.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground"
          style={{ borderColor: wl.error ? "hsl(0 72% 55%)" : undefined }}
        />
        <button
          type="submit"
          disabled={wl.status === "submitting"}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium text-white shadow transition-opacity hover:opacity-90 disabled:opacity-70"
          style={{ backgroundColor: ACCENT }}
        >
          <SubmitArrow label="Join the waitlist" status={wl.status} />
        </button>
      </div>
      <FormHint error={wl.error} />
    </form>
  );
}
