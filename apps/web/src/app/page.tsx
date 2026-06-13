import { auth } from "@code-main/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { MailPage } from "@/features/mail/components/mail-page";

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  return <MailPage />;
}
