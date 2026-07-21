"use client";

import { FileText, Search, Send, Sparkles } from "lucide-react";
import * as React from "react";

import { Badge } from "@code-main/ui/components/badge";
import { Button } from "@code-main/ui/components/button";
import { Input } from "@code-main/ui/components/input";
import { Separator } from "@code-main/ui/components/separator";

const ACCENT = "#3b82f6";

function usePrefersReducedMotion() {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  return reduced;
}

/* Loops a step index 0..steps on an interval; respects reduced motion. */
function useLoopStep(steps: number, interval: number, hold = 2400) {
  const [step, setStep] = React.useState(0);
  const reduced = usePrefersReducedMotion();
  React.useEffect(() => {
    if (reduced) {
      setStep(steps);
      return;
    }
    let t: ReturnType<typeof setTimeout>;
    const tick = (s: number) => {
      if (s <= steps) {
        setStep(s);
        t = setTimeout(() => tick(s + 1), interval);
      } else {
        t = setTimeout(() => {
          setStep(0);
          t = setTimeout(() => tick(1), interval);
        }, hold);
      }
    };
    t = setTimeout(() => tick(1), 700);
    return () => clearTimeout(t);
  }, [reduced, steps, interval, hold]);
  return { step, reduced };
}

/* ── Summarize the open thread (Ask AI panel replica) ─────── */

const SUMMARY_POINTS = [
  "Dana wants to move the Q3 vendor call to Thursday.",
  "Two vendors still owe pricing before the call.",
  "Marcus's signed lease is attached and needs filing.",
  "Nothing else in this thread needs a reply from you.",
];

export function SummarizeDemo() {
  const { step } = useLoopStep(SUMMARY_POINTS.length, 650);
  return (
    <DemoShell label="Ask AI">
      <div className="flex items-center justify-end px-4 pt-4">
        <span className="max-w-[70%] rounded-lg bg-muted px-3 py-1.5 text-xs">
          Summarize this thread
        </span>
      </div>
      <div className="flex-1 px-4 py-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="size-3.5" style={{ color: ACCENT }} />
          {step < SUMMARY_POINTS.length ? "summarizing…" : "4 threads · 12 messages"}
        </div>
        <ul className="space-y-2">
          {SUMMARY_POINTS.map((point, i) => (
            <li
              key={point}
              className="flex items-start gap-2 text-xs leading-relaxed transition-all duration-300"
              style={{
                opacity: i < step ? 1 : 0,
                transform: i < step ? "translateY(0)" : "translateY(4px)",
              }}
            >
              <span
                className="mt-1.5 size-1 shrink-0 rounded-full"
                style={{ backgroundColor: ACCENT }}
              />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </div>
      <Separator />
      <div className="p-3">
        <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs text-muted-foreground">
          <FileText className="size-3.5" />
          Ask a follow-up…
          <Send className="ml-auto size-3.5" />
        </div>
      </div>
    </DemoShell>
  );
}

/* ── Search in plain words (NLP filter) ───────────────────── */

const SEARCH_QUERY = "unread invoices waiting on me";
const SEARCH_ALL = [
  { name: "Ramp", subj: "Invoice #2291 is due", match: true },
  { name: "Figma", subj: "Weekly product digest", match: false },
  { name: "Stripe", subj: "Payout of $4,120.00 sent", match: false },
  { name: "AWS", subj: "Invoice available for June", match: true },
  { name: "Dana Okafor", subj: "Q3 vendor call", match: false },
  { name: "Notion", subj: "We miss you! Come back", match: false },
];

type SearchMessage = (typeof SEARCH_ALL)[number];

const SEARCH_ROW_SHOWN = {
  maxHeight: 44,
  opacity: 1,
  paddingTop: 8,
  paddingBottom: 8,
  borderWidth: 1,
  marginBottom: 6,
} satisfies React.CSSProperties;
const SEARCH_ROW_HIDDEN = {
  maxHeight: 0,
  opacity: 0,
  paddingTop: 0,
  paddingBottom: 0,
  borderWidth: 0,
  marginBottom: 0,
} satisfies React.CSSProperties;

function SearchResultRow({
  message,
  shown,
  showBadge,
}: {
  message: SearchMessage;
  shown: boolean;
  showBadge: boolean;
}) {
  return (
    <div
      className="flex items-center gap-2 overflow-hidden rounded-md border px-3 text-xs transition-all duration-300"
      style={shown ? SEARCH_ROW_SHOWN : SEARCH_ROW_HIDDEN}
    >
      <span className="w-24 shrink-0 truncate font-medium">{message.name}</span>
      <span className="truncate text-muted-foreground">{message.subj}</span>
      {showBadge && (
        <Badge className="ml-auto shrink-0" variant="default">
          unread
        </Badge>
      )}
    </div>
  );
}

export function SearchDemo() {
  const reduced = usePrefersReducedMotion();
  const [typed, setTyped] = React.useState(0);
  const [filtered, setFiltered] = React.useState(false);

  React.useEffect(() => {
    if (reduced) {
      setTyped(SEARCH_QUERY.length);
      setFiltered(true);
      return;
    }
    let t: ReturnType<typeof setTimeout>;
    let i = 0;
    const type = () => {
      i += 1;
      setTyped(i);
      if (i < SEARCH_QUERY.length) {
        t = setTimeout(type, 45);
      } else {
        t = setTimeout(() => {
          setFiltered(true);
          t = setTimeout(() => {
            setFiltered(false);
            i = 0;
            setTyped(0);
            t = setTimeout(type, 700);
          }, 3200);
        }, 500);
      }
    };
    t = setTimeout(type, 700);
    return () => clearTimeout(t);
  }, [reduced]);

  const visible = SEARCH_ALL.filter((m) => (filtered ? m.match : true));

  return (
    <DemoShell label="Search">
      <div className="p-3">
        <div className="relative">
          <Search className="absolute top-2.5 left-2 size-4 text-muted-foreground" />
          <Input
            className="pl-8"
            readOnly
            value={SEARCH_QUERY.slice(0, typed)}
            placeholder="Search mail"
          />
        </div>
      </div>
      <Separator />
      <div className="flex-1 space-y-1.5 p-3">
        <div className="px-1 pb-1 font-mono text-[10px] text-muted-foreground">
          {filtered ? `${visible.length} matches` : `${SEARCH_ALL.length} messages`}
        </div>
        {SEARCH_ALL.map((m) => (
          <SearchResultRow
            key={m.subj}
            message={m}
            shown={filtered ? m.match : true}
            showBadge={m.match && filtered}
          />
        ))}
      </div>
    </DemoShell>
  );
}

/* ── Draft replies in your voice (before / after) ─────────── */

const DRAFT_ROUGH = "cant do thursday. maybe next week? sorry";
const DRAFT_POLISHED: readonly { t: string; add: boolean }[] = [
  { t: "Hi Dana — Thursday doesn't work for me, ", add: false },
  { t: "but I'd love to make this happen. ", add: true },
  { t: "Could we aim for early next week? ", add: false },
  { t: "Tuesday or Wednesday afternoon are both open on my end.", add: true },
];

export function DraftDemo() {
  const reduced = usePrefersReducedMotion();
  const [reveal, setReveal] = React.useState(false);
  React.useEffect(() => {
    if (reduced) {
      setReveal(true);
      return;
    }
    setReveal(false);
    const on = setTimeout(() => setReveal(true), 700);
    const off = setInterval(() => setReveal((r) => !r), 3400);
    return () => {
      clearTimeout(on);
      clearInterval(off);
    };
  }, [reduced]);

  return (
    <DemoShell label="Draft">
      <div className="grid flex-1 grid-rows-2 divide-y divide-border">
        <div className="p-4">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-border" />
            what you typed
          </div>
          <p className="mt-3 font-mono text-xs leading-relaxed text-muted-foreground">
            {DRAFT_ROUGH}
            <span className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 animate-pulse bg-muted-foreground align-middle" />
          </p>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            <span className="size-1.5 rounded-full" style={{ backgroundColor: ACCENT }} />
            what Mail sends
          </div>
          <p
            className="mt-3 text-xs leading-relaxed transition-opacity duration-500"
            style={{ opacity: reveal ? 1 : 0 }}
          >
            {DRAFT_POLISHED.map((seg, i) => (
              <span
                key={i}
                style={
                  seg.add
                    ? {
                        backgroundColor: "color-mix(in oklab, " + ACCENT + " 16%, transparent)",
                        borderRadius: "3px",
                        padding: "1px 2px",
                        boxDecorationBreak: "clone",
                        WebkitBoxDecorationBreak: "clone",
                      }
                    : undefined
                }
              >
                {seg.t}
              </span>
            ))}
          </p>
        </div>
      </div>
      <Separator />
      <div className="flex items-center justify-between p-3">
        <span className="font-mono text-[10px] text-muted-foreground">
          highlighted = added by Mail
        </span>
        <div className="flex gap-1.5">
          <Button size="xs">Send</Button>
          <Button size="xs" variant="outline">
            Edit
          </Button>
        </div>
      </div>
    </DemoShell>
  );
}

/* ── Triage ledger (roadmap section) ──────────────────────── */

type Row = { action: string; who: string; subject: string; tag: string };
const LEDGER: readonly Row[] = [
  { action: "muted", who: "Notion", subject: "We miss you! Come back", tag: "noise" },
  { action: "labeled", who: "Ramp", subject: "Invoice #2291 is due", tag: "receipts" },
  { action: "archived", who: "Amazon", subject: "Your order has shipped", tag: "receipts" },
  { action: "starred", who: "Marcus Lee", subject: "Lease — final signature", tag: "needs you" },
  { action: "drafted", who: "Dana Okafor", subject: "Re: Q3 vendor call", tag: "needs you" },
  { action: "muted", who: "LinkedIn", subject: "3 new roles for you", tag: "noise" },
  { action: "archived", who: "Figma", subject: "Weekly product digest", tag: "newsletter" },
  { action: "labeled", who: "Stripe", subject: "Payout of $4,120.00 sent", tag: "receipts" },
];
const START = 148;

function triageActionStyle(action: Row["action"]) {
  return action === "drafted" || action === "starred" ? { color: ACCENT } : undefined;
}

function triageTagStyle(tag: Row["tag"]) {
  return tag === "needs you"
    ? { border: `1px solid ${ACCENT}`, color: ACCENT }
    : { border: "1px solid var(--border)", color: "var(--muted-foreground)" };
}

function TriageRow({ row, isFirst }: { row: Row; isFirst: boolean }) {
  return (
    <div
      className="grid grid-cols-[80px_1fr_auto] items-center gap-3 px-4 py-3 font-mono text-xs"
      style={isFirst ? { animation: "homeTriageIn 0.4s ease" } : undefined}
    >
      <span className="font-medium" style={triageActionStyle(row.action)}>
        {row.action}
      </span>
      <span className="truncate text-foreground">
        <span className="text-muted-foreground">{row.who}: </span>
        {row.subject}
      </span>
      <span className="rounded px-1.5 py-0.5 text-[10px]" style={triageTagStyle(row.tag)}>
        {row.tag}
      </span>
    </div>
  );
}

export function TriageLedger() {
  const reduced = usePrefersReducedMotion();
  const [rows, setRows] = React.useState<Row[]>(LEDGER.slice(0, 7));
  const [count, setCount] = React.useState(START);

  React.useEffect(() => {
    if (reduced) return;
    // Start past the 7 seeded rows so the first streamed row isn't a repeat.
    let i = LEDGER.length;
    const id = setInterval(() => {
      setRows((r) => [LEDGER[i % LEDGER.length], ...r].slice(0, 7));
      setCount((c) => {
        const next = c - (9 + (i % 6));
        return next <= 4 ? START : next;
      });
      i += 1;
    }, 950);
    return () => clearInterval(id);
  }, [reduced]);

  const cleared = Math.max(0, START - count);
  const flagged = rows.filter((r) => r.tag === "needs you").length || 2;

  return (
    <div className="overflow-hidden rounded-lg border bg-background shadow-2xl shadow-black/40">
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2.5">
        <span className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
          <span
            className="size-1.5 animate-pulse rounded-full"
            style={{ backgroundColor: ACCENT }}
          />
          triage.log
        </span>
        <span className="font-mono text-[11px] text-muted-foreground">live</span>
      </div>
      <div className="divide-y divide-border">
        {rows.map((r, i) => (
          <TriageRow key={`${r.subject}-${i}`} row={r} isFirst={i === 0} />
        ))}
      </div>
      <div className="border-t border-border bg-muted/20 px-4 py-2.5 font-mono text-[11px] text-muted-foreground">
        {cleared} handled · {count} left · {flagged} flagged for you
      </div>
      <style>{`@keyframes homeTriageIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}

/* ── Shared chrome for the small feature demos ────────────── */

function DemoShell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex h-[320px] flex-col overflow-hidden rounded-lg border bg-background shadow-xl shadow-black/30">
      <div className="flex h-[44px] shrink-0 items-center gap-2 border-b border-border px-4">
        <Sparkles className="size-4" style={{ color: ACCENT }} />
        <span className="text-sm font-semibold">{label}</span>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">live</span>
      </div>
      {children}
    </div>
  );
}
