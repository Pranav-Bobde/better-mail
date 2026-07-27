import { auth } from "@code-main/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { LoginForm } from "@/features/auth/components/login-form";
import { SIGN_IN_ENABLED } from "@/shared/lib/access";

export default async function LoginPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session) {
    redirect("/");
  }

  // Pre-launch: no public sign-in surface. Send visitors back to the waitlist.
  if (!SIGN_IN_ENABLED) {
    redirect("/");
  }

  return (
    <main className="flex min-h-full items-center justify-center bg-background px-6 py-12 text-foreground">
      <LoginForm />
    </main>
  );
}
