import { getAuthorizedSession } from "@code-main/auth";
import { headers } from "next/headers";

import { LandingPage } from "@/features/mail/components/landing/landing-page";
import { MailPage } from "@/features/mail/components/mail-page";

export default async function Home() {
  const session = await getAuthorizedSession(await headers());

  if (!session) {
    return <LandingPage />;
  }

  return <MailPage />;
}
