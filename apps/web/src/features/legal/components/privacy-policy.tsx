import {
  LegalLink,
  LegalSection,
  LegalShell,
  legalContactLinks,
} from "@/features/legal/components/legal-shell";

const GOOGLE_USER_DATA_POLICY_URL =
  "https://developers.google.com/terms/api-services-user-data-policy";
const GOOGLE_PERMISSIONS_URL = "https://myaccount.google.com/permissions";

export function PrivacyPolicy() {
  return (
    <LegalShell title="Privacy Policy" effectiveDate="July 24, 2026">
      <LegalSection heading="1. What this service is">
        <p>
          Mail is an open-source AI email client for Gmail, developed as the{" "}
          <LegalLink href={legalContactLinks.repoUrl}>better-mail</LegalLink> project. This policy
          covers the hosted service you sign into on this site. If you self-host the open-source
          code, your deployment is governed by your own configuration, not this policy.
        </p>
      </LegalSection>

      <LegalSection heading="2. What data we collect">
        <p>When you use the hosted service, we collect:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Your Google account basics from sign-in: name, email address, and profile image.</li>
          <li>OAuth tokens for your Google account, stored encrypted.</li>
          <li>Gmail mailbox data that we cache to run the app (detailed below).</li>
          <li>Your email address if you join the waitlist.</li>
          <li>Operational logs and metrics about requests to the service.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="3. What Gmail data we access">
        <p>
          Mail connects to Gmail through Google OAuth. The requested access lets Mail read your
          mailbox to display and sync it, manage mailbox state such as labels, read status, and
          drafts, and send email on your behalf. Sending always requires an explicit action from you
          — the assistant only prepares drafts; nothing is sent until you choose to send it.
        </p>
      </LegalSection>

      <LegalSection heading="4. What Gmail data we store or cache">
        <p>
          We cache Gmail data so the app can load, sync, search, and power AI features. The cache
          includes your account email address, sync cursors, labels, thread metadata, and message
          data: subjects, snippets, text and HTML bodies, sender and recipient addresses, and
          timestamps.
        </p>
      </LegalSection>

      <LegalSection heading="5. How AI features use your data">
        <p>
          AI requests happen only when you use an AI feature such as Ask AI. When you do, the
          selected email, the visible inbox context, and any compose or draft text you provide are
          sent to a model provider to produce the response. Requests are routed through OpenRouter
          with provider data collection denied, and we use zero-data-retention routing where
          available for AI requests involving Gmail content.
        </p>
        <p>
          Model providers may process prompt data to produce responses, subject to their policies
          and our routing controls.
        </p>
      </LegalSection>

      <LegalSection heading="6. Who receives data">
        <p>Running the hosted service relies on these providers:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Google — sign-in and the Gmail API.</li>
          <li>Vercel — application hosting.</li>
          <li>Neon — the Postgres database holding the mailbox cache.</li>
          <li>
            OpenRouter and the model providers it routes to — AI requests, as described above.
          </li>
          <li>LangSmith — AI observability, with prompt inputs and outputs hidden (see below).</li>
          <li>Ably — realtime notifications that tell your open session the mailbox changed.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="7. What we do not do with your data">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>We do not sell your data.</li>
          <li>We do not use your Gmail data for advertising.</li>
          <li>We do not train our own models on your Gmail data.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="8. Google API Limited Use">
        <p>
          Mail&apos;s use and transfer to any other app of information received from Google APIs
          will adhere to the{" "}
          <LegalLink href={GOOGLE_USER_DATA_POLICY_URL}>
            Google API Services User Data Policy
          </LegalLink>
          , including the Limited Use requirements.
        </p>
      </LegalSection>

      <LegalSection heading="9. Logs, debugging, and support">
        <p>
          Our observability excludes email content by policy. AI traces hide prompt inputs and
          outputs; logs and traces carry non-content metadata such as request identifiers, routes,
          model identifiers, latency, token counts, and error codes. Support debugging uses redacted
          traces by default; raw content capture requires explicit debug handling.
        </p>
      </LegalSection>

      <LegalSection heading="10. Data retention and deletion">
        <p>
          The synced mailbox cache is retained while your account stays connected, so the app can
          load without re-syncing everything. You can delete your account yourself from the app
          sidebar (&quot;Delete account&quot;): this removes your account and all cached mail data,
          and the app attempts to revoke its own Google access as part of deletion. You can also
          request deletion by opening an issue at{" "}
          <LegalLink href={legalContactLinks.issuesUrl}>the better-mail issue tracker</LegalLink>.
        </p>
        <p>
          You can also revoke Mail&apos;s access to your Google account at any time from{" "}
          <LegalLink href={GOOGLE_PERMISSIONS_URL}>your Google account permissions</LegalLink>.
          Revoking stops all further access; delete your account to remove the cached copy as well.
        </p>
      </LegalSection>

      <LegalSection heading="11. Security basics">
        <p>
          Sign-in uses Google OAuth. OAuth tokens are stored encrypted, and data moves over
          encrypted connections. No system is perfectly secure, but we keep the surface small: the
          hosted service stores only what the app needs to run.
        </p>
      </LegalSection>

      <LegalSection heading="12. Your choices and controls">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>AI features run only when you invoke them; skip them and no AI request is made.</li>
          <li>Disconnect Mail from your Google account permissions at any time.</li>
          <li>
            Delete your account and cached data from the app sidebar, or request deletion through
            the issue tracker.
          </li>
          <li>Self-host the open-source code and keep everything on your own infrastructure.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="13. Contact">
        <p>
          Questions and requests go through{" "}
          <LegalLink href={legalContactLinks.issuesUrl}>GitHub issues on better-mail</LegalLink>.
        </p>
      </LegalSection>

      <LegalSection heading="14. Changes to this policy">
        <p>
          If this policy changes, we will update this page and its effective date. Meaningful
          changes will be visible in the project&apos;s open-source history.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
