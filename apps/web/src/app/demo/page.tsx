import type { Metadata } from "next";

import { MailPage } from "@/features/mail/components/mail-page";

export const metadata: Metadata = {
  title: "Demo — Mail",
  description: "Try the AI mail client workspace on a sample mailbox. No sign-in required.",
};

// Public on purpose: no session lookup, no gate. The workspace runs against
// in-browser fixture data, so nothing here can reach a real mailbox.
export default function DemoPage() {
  return <MailPage demoMode />;
}
