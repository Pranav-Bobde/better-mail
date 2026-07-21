"use client";

import {
  Archive,
  Clock,
  Command,
  FileText,
  Github,
  Keyboard,
  ListChecks,
  MessageSquareText,
  Search,
  Sparkles,
  Star,
} from "lucide-react";
import * as React from "react";

import { Badge } from "@code-main/ui/components/badge";

import {
  ACCENT,
  Eyebrow,
  GoogleCta,
  Kbd,
  Wordmark,
} from "@/features/mail/components/landing/landing-kit";
import { WaitlistForm } from "@/features/mail/components/landing/waitlist/waitlist-live";
import {
  DraftDemo,
  SearchDemo,
  SummarizeDemo,
  TriageLedger,
} from "@/features/mail/components/landing/landing-demos";
import { MailAppReplica } from "@/features/mail/components/landing/landing-mock";

/* ── Top nav ──────────────────────────────────────────────── */

function TopNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Wordmark />
        <nav className="hidden items-center gap-6 md:flex">
          <a
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            href="#features"
          >
            Features
          </a>
          <a
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            href="#roadmap"
          >
            Roadmap
          </a>
          <a
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            href="https://github.com/Pranav-Bobde/better-mail"
          >
            GitHub
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <a
            href="https://github.com/Pranav-Bobde/better-mail"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-transparent px-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent"
          >
            <Star className="size-4" />
            Star
          </a>
          <a
            href="/login"
            className="inline-flex h-9 items-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign in
          </a>
        </div>
      </div>
    </header>
  );
}

/* ── Small status tag ─────────────────────────────────────── */

function Tag({ kind }: { kind: "now" | "soon" }) {
  if (kind === "now") {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em]"
        style={{ borderColor: ACCENT, color: ACCENT }}
      >
        <span className="size-1.5 rounded-full" style={{ backgroundColor: ACCENT }} />
        Available now
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
      <Clock className="size-2.5" />
      Coming soon
    </span>
  );
}

/* ── Feature row: copy + live demo ────────────────────────── */

function FeatureRow({
  index,
  icon: Icon,
  title,
  body,
  bullets,
  demo,
  reverse,
}: {
  index: string;
  icon: typeof Search;
  title: string;
  body: string;
  bullets: readonly string[];
  demo: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-16">
      <div className={reverse ? "lg:order-2" : ""}>
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-md border border-border">
            <Icon className="size-4" style={{ color: ACCENT }} />
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">{index}</span>
          <Tag kind="now" />
        </div>
        <h3 className="mt-5 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h3>
        <p className="mt-3 max-w-md text-pretty text-base leading-relaxed text-muted-foreground">
          {body}
        </p>
        <ul className="mt-5 space-y-2">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2.5 text-sm text-muted-foreground">
              <span
                className="mt-1.5 size-1 shrink-0 rounded-full"
                style={{ backgroundColor: ACCENT }}
              />
              {b}
            </li>
          ))}
        </ul>
      </div>
      <div className={reverse ? "lg:order-1" : ""}>{demo}</div>
    </div>
  );
}

/* ── Capability bento tile ────────────────────────────────── */

function CapabilityTile({
  icon: Icon,
  title,
  body,
  kind,
  className = "",
  children,
}: {
  icon: typeof Search;
  title: string;
  body: string;
  kind: "now" | "soon";
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <article
      className={`flex flex-col justify-between gap-6 rounded-lg border border-border bg-background p-6 ${className}`}
    >
      <div className="flex items-center justify-between">
        <Icon className="size-5 text-muted-foreground" />
        <Tag kind={kind} />
      </div>
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
        {children}
      </div>
    </article>
  );
}

/* ── Footer ───────────────────────────────────────────────── */

const FOOTER_PRODUCT = [
  { label: "Features", href: "#features" },
  { label: "Roadmap", href: "#roadmap" },
  { label: "Sign in", href: "/login" },
];
const FOOTER_OSS = [
  { label: "Source code", href: "https://github.com/Pranav-Bobde/better-mail" },
  { label: "Report an issue", href: "https://github.com/Pranav-Bobde/better-mail/issues" },
  { label: "Request a feature", href: "https://github.com/Pranav-Bobde/better-mail/issues/new" },
];

function ProductFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <Wordmark />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              An open-source AI email client. Connects to Gmail; your mail stays in your mailbox.
            </p>
            <div className="mt-5 flex gap-2">
              <a
                href="https://github.com/Pranav-Bobde/better-mail"
                className="inline-flex h-9 items-center gap-2 rounded-md border border-input px-3 text-sm font-medium transition-colors hover:bg-accent"
              >
                <Github className="size-4" /> GitHub
              </a>
              <a
                href="/login"
                className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Sign in
              </a>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-10">
            <FooterColumn head="Product" links={FOOTER_PRODUCT} />
            <FooterColumn head="Open source" links={FOOTER_OSS} />
          </div>
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-2 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row">
          <span>Built by Pranav-Bobde · MIT licensed · Not affiliated with Google.</span>
          <a
            className="font-mono transition-colors hover:text-foreground"
            href="https://github.com/Pranav-Bobde/better-mail"
          >
            github.com/Pranav-Bobde/better-mail
          </a>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  head,
  links,
}: {
  head: string;
  links: readonly { label: string; href: string }[];
}) {
  return (
    <div>
      <h4 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {head}
      </h4>
      <ul className="mt-4 space-y-2.5 text-sm">
        {links.map((link) => (
          <li key={link.label}>
            <a
              className="text-muted-foreground transition-colors hover:text-foreground"
              href={link.href}
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────── */

export function LandingPage() {
  return (
    <main className="min-h-svh overflow-x-hidden bg-background text-foreground">
      <TopNav />

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-5 pt-16 pb-10 sm:px-8 sm:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="flex justify-center">
            <Eyebrow>open source · Gmail</Eyebrow>
          </div>
          <h1 className="mx-auto mt-6 max-w-3xl text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            Your inbox, with an AI that <span style={{ color: ACCENT }}>actually helps.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground">
            Open-source and Gmail-native. Ask AI summarizes any thread, searches in plain words, and
            drafts your replies — you just decide what sends.
          </p>
          <div className="mt-8">
            <WaitlistForm source="landing-hero" />
            <div className="mt-4 flex items-center justify-center gap-4 text-xs text-muted-foreground">
              <a
                href="https://github.com/Pranav-Bobde/better-mail"
                className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
              >
                <Github className="size-3.5" />
                Star on GitHub
              </a>
              <span aria-hidden>·</span>
              <a href="/login" className="transition-colors hover:text-foreground">
                Have access? Sign in
              </a>
            </div>
          </div>
        </div>

        <div className="mt-14">
          <MailAppReplica />
          <p className="mt-3 text-center font-mono text-[11px] text-muted-foreground">
            The actual workspace — same components you sign into.
          </p>
        </div>
      </section>

      {/* Available now */}
      <section id="features" className="border-t border-border">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <div className="max-w-2xl">
            <Eyebrow>available now</Eyebrow>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
              Less reading, less typing, less searching.
            </h2>
            <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">
              Three jobs the assistant takes off your plate the moment you open a thread — each one
              a keystroke away.
            </p>
          </div>

          <div className="mt-16 space-y-20">
            <FeatureRow
              index="01"
              icon={MessageSquareText}
              title="Summarize the open thread"
              body="Long back-and-forth you don't have time to read? Ask AI folds the whole thread into the few points that actually change what you do next."
              bullets={[
                "Works on a single message or a 40-reply chain",
                "Pulls out who's waiting on you and what for",
                "Ask a follow-up without leaving the thread",
              ]}
              demo={<SummarizeDemo />}
            />
            <FeatureRow
              index="02"
              icon={Search}
              title="Search in plain words"
              body="Describe what you're after the way you'd say it out loud. Mail turns it into the right filter and narrows the list in place — no operators to memorize."
              bullets={[
                '"unread invoices waiting on me" just works',
                "Filters the mailbox you're already looking at",
                "Open a result straight from the results",
              ]}
              demo={<SearchDemo />}
              reverse
            />
            <FeatureRow
              index="03"
              icon={FileText}
              title="Draft replies in your voice"
              body="Type the gist — half a sentence is enough. Ask AI writes a reply that sounds like you and shows exactly what it added before anything sends."
              bullets={[
                "Reads the thread for names, dates, and tone",
                "Highlights every phrase it contributed",
                "Send, edit, or open in the composer",
              ]}
              demo={<DraftDemo />}
            />
          </div>
        </div>
      </section>

      {/* Roadmap — triage */}
      <section id="roadmap" className="border-t border-border">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_1.05fr]">
          <div>
            <div className="flex items-center gap-3">
              <Eyebrow>on the roadmap</Eyebrow>
              <Tag kind="soon" />
            </div>
            <h2 className="mt-5 text-balance text-3xl font-semibold leading-[1.05] tracking-tight sm:text-4xl">
              Next: watch your unread count fall to nearly zero.
            </h2>
            <p className="mt-4 max-w-md text-pretty text-base leading-relaxed text-muted-foreground">
              We're building automatic triage on top of the assistant — Mail will sort the receipts,
              mute the noise, and flag the few threads that need you, showing its work line by line.
              Nothing deleted, every move reversible.
            </p>
            <ul className="mt-6 space-y-2">
              {[
                "Files receipts and mutes noise on the first sync",
                "Flags what needs a human, drafts the rest",
                "Every action lands in a log you can undo",
              ].map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <ListChecks className="mt-0.5 size-4 shrink-0" style={{ color: ACCENT }} />
                  {b}
                </li>
              ))}
            </ul>
          </div>
          <TriageLedger />
        </div>
      </section>

      {/* Everything else — capability grid */}
      <section id="everything" className="border-t border-border">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <div className="max-w-2xl">
            <Eyebrow>the whole surface</Eyebrow>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
              Everything email should already do.
            </h2>
            <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">
              What's live today, and what's coming as the assistant grows into the rest of the
              inbox.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <CapabilityTile
              icon={Sparkles}
              title="Ask AI, in context"
              body="Summaries, search, and drafts that already know the thread you're reading."
              kind="now"
            />
            <CapabilityTile
              icon={Search}
              title="Plain-words search"
              body="Say what you want; Mail builds the filter and narrows the list."
              kind="now"
            />
            <CapabilityTile
              icon={FileText}
              title="Reply drafting"
              body="A polished reply from a rough note, with every edit shown."
              kind="now"
            />
            <CapabilityTile
              icon={Archive}
              title="Auto-triage"
              body="Receipts filed, noise muted, the rest flagged — automatically."
              kind="soon"
            />
            <CapabilityTile
              icon={Clock}
              title="Snooze & follow-up"
              body="Send a thread away; it returns exactly when you asked."
              kind="soon"
            >
              <div className="mt-3 flex flex-wrap gap-1.5">
                {["Mon 9am", "in 3 days", "when they reply"].map((c) => (
                  <span
                    key={c}
                    className="rounded-md border border-border bg-muted/40 px-2 py-1 font-mono text-[11px] text-muted-foreground"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </CapabilityTile>
            <CapabilityTile
              icon={Command}
              title="Command bar"
              body="Type an instruction, run it across the mailbox — hands on the keys."
              kind="soon"
            />
            <CapabilityTile
              icon={Keyboard}
              title="Keyboard-first triage"
              body="Move through the inbox without ever reaching for the mouse."
              kind="soon"
            >
              <div className="mt-3 flex flex-wrap gap-1.5">
                {["J", "K", "E", "R", "⌘K"].map((k) => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
              </div>
            </CapabilityTile>
            <CapabilityTile
              icon={ListChecks}
              title="Triage log"
              body="A live ledger of every automatic action, fully reversible."
              kind="soon"
            />
            <div className="flex flex-col justify-between gap-6 rounded-lg border border-border bg-muted/20 p-6">
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                get started
              </span>
              <div>
                <h3 className="text-sm font-semibold">Connect Gmail in one click.</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  The assistant starts working from the first sync.
                </p>
                <div className="mt-4">
                  <GoogleCta full />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-5 py-20 text-center sm:px-8">
          <Badge variant="secondary" className="mb-5">
            No new inbox to learn
          </Badge>
          <h2 className="mx-auto max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Let the assistant take the first pass at your inbox.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-pretty text-base leading-relaxed text-muted-foreground">
            Connect your Google account and open Mail. It reads, sorts, and drafts — you decide what
            sends.
          </p>
          <div className="mt-8 flex justify-center">
            <GoogleCta />
          </div>
        </div>
      </section>

      <ProductFooter />
    </main>
  );
}
