import { getAuthorizedSession } from "@code-main/auth";
import { env } from "@code-main/env/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { LoginForm } from "@/features/auth/components/login-form";
import { isSignInPageEnabled } from "@/shared/lib/access";

export default async function LoginPage() {
  const session = await getAuthorizedSession(await headers());

  if (session) {
    redirect("/");
  }

  // Public sign-in stays closed; stable staging and production expose owner-only OAuth.
  if (!isSignInPageEnabled(env.BETTER_AUTH_URL)) {
    redirect("/");
  }

  return (
    <main className="flex min-h-full items-center justify-center bg-background px-6 py-12 text-foreground">
      <LoginForm />
    </main>
  );
}
