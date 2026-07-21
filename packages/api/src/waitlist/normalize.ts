import { createHash } from "node:crypto";

// Domains where dots in the local part are ignored and mail lands in the same
// gmail.com inbox.
const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

function stripPlusTag(local: string): string {
  return local.split("+")[0] ?? local;
}

// Canonicalize so gmail dot/plus variants ("a.b+x@gmail.com") dedupe to one
// row via the unique `normalizedEmail` column.
export function normalizeEmail(raw: string): string {
  const email = raw.trim().toLowerCase();
  const [local, domain] = email.split("@");
  if (!local || !domain) {
    return email;
  }

  const base = stripPlusTag(local);
  return GMAIL_DOMAINS.has(domain) ? `${base.replace(/\./g, "")}@gmail.com` : `${base}@${domain}`;
}

const IP_HASH_SALT = "mail-waitlist-iphash-v1";

export function hashIp(ip: string | null): string | null {
  if (!ip) {
    return null;
  }

  return createHash("sha256").update(`${IP_HASH_SALT}:${ip}`).digest("hex").slice(0, 40);
}
