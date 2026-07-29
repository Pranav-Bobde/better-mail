import * as React from "react";

const REPO_URL = "https://github.com/Pranav-Bobde/better-mail";
const ISSUES_URL = "https://github.com/Pranav-Bobde/better-mail/issues";

export const legalContactLinks = { repoUrl: REPO_URL, issuesUrl: ISSUES_URL } as const;

export function LegalShell({
  title,
  effectiveDate,
  children,
}: {
  title: string;
  effectiveDate: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-svh bg-background text-foreground">
      <header className="border-b border-border/70">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-5">
          <a className="text-sm font-semibold transition-colors hover:text-foreground" href="/">
            Mail
          </a>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <a className="transition-colors hover:text-foreground" href="/privacy">
              Privacy
            </a>
            <a className="transition-colors hover:text-foreground" href="/terms">
              Terms
            </a>
            <a className="transition-colors hover:text-foreground" href={REPO_URL}>
              GitHub
            </a>
          </nav>
        </div>
      </header>

      <article className="mx-auto max-w-2xl px-5 py-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Legal
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-xs text-muted-foreground">Effective date: {effectiveDate}</p>
        <div className="mt-8 space-y-8">{children}</div>
      </article>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-2xl flex-col items-start justify-between gap-2 px-5 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <span>Built by Pranav-Bobde · MIT licensed · Not affiliated with Google.</span>
          <a className="font-mono transition-colors hover:text-foreground" href={REPO_URL}>
            github.com/Pranav-Bobde/better-mail
          </a>
        </div>
      </footer>
    </main>
  );
}

export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-base font-semibold">{heading}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export function LegalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a className="text-foreground underline underline-offset-4 hover:no-underline" href={href}>
      {children}
    </a>
  );
}
