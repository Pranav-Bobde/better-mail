import {
  LegalLink,
  LegalSection,
  LegalShell,
  legalContactLinks,
} from "@/features/legal/components/legal-shell";

export function TermsOfService() {
  return (
    <LegalShell title="Terms of Service" effectiveDate="July 24, 2026">
      <LegalSection heading="1. The service">
        <p>
          Mail is an open-source AI email client for Gmail, developed as the{" "}
          <LegalLink href={legalContactLinks.repoUrl}>better-mail</LegalLink> project. These terms
          cover the hosted service you sign into on this site. By using it, you agree to them.
        </p>
      </LegalSection>

      <LegalSection heading="2. Open-source code vs hosted service">
        <p>
          The code is MIT-licensed. You may self-host it; when you do, you are responsible for your
          own deployment, credentials, and compliance, and these terms do not apply to it.
        </p>
      </LegalSection>

      <LegalSection heading="3. Your account and Gmail connection">
        <p>
          You sign in with a Google account you control and authorize Mail to access your Gmail
          mailbox. You are responsible for activity under your account. How we handle your data is
          described in the <LegalLink href="/privacy">Privacy Policy</LegalLink>.
        </p>
      </LegalSection>

      <LegalSection heading="4. AI outputs and user approval">
        <p>
          AI-generated summaries, search results, and drafts can be wrong. Review them before
          relying on them. Nothing is sent from your mailbox without your explicit action — you
          approve every send.
        </p>
      </LegalSection>

      <LegalSection heading="5. Acceptable use">
        <p>Do not use the service to:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>send spam, or unlawful, deceptive, or abusive email;</li>
          <li>access mailboxes you are not authorized to access;</li>
          <li>violate Google&apos;s or Gmail&apos;s terms and policies;</li>
          <li>probe, overload, or disrupt the service or its infrastructure.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="6. Free service, changes, and suspension">
        <p>
          The hosted service is currently free and in active development. Features may change, be
          rate-limited, or be removed, and the service may be suspended or discontinued. We may
          suspend accounts that violate these terms.
        </p>
      </LegalSection>

      <LegalSection heading="7. Termination and data deletion">
        <p>
          You can stop using the service at any time and revoke Mail&apos;s access from your Google
          account settings. Deletion of cached account data is handled as described in the{" "}
          <LegalLink href="/privacy">Privacy Policy</LegalLink>.
        </p>
      </LegalSection>

      <LegalSection heading="8. No warranty and liability limits">
        <p>
          The service is provided &quot;as is&quot;, without warranty of any kind, express or
          implied. To the maximum extent permitted by law, the developer is not liable for any
          damages arising from your use of the service, including lost data, lost profits, or
          consequential damages.
        </p>
      </LegalSection>

      <LegalSection heading="9. Google and Gmail trademarks">
        <p>
          Google and Gmail are trademarks of Google LLC. Mail is an independent open-source project
          and is not affiliated with, endorsed by, or sponsored by Google.
        </p>
      </LegalSection>

      <LegalSection heading="10. Changes to these terms">
        <p>
          If these terms change, we will update this page and its effective date. Continued use of
          the service after a change means you accept the updated terms.
        </p>
      </LegalSection>

      <LegalSection heading="11. Contact">
        <p>
          Questions go through{" "}
          <LegalLink href={legalContactLinks.issuesUrl}>GitHub issues on better-mail</LegalLink>.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
