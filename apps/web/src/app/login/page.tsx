import { auth } from "@code-main/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { LoginForm } from "@/features/auth/components/login-form";

export default async function LoginPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session) {
    redirect("/");
  }

  return (
    <main className="flex min-h-full items-center justify-center bg-background px-6 py-12 text-foreground">
      <LoginForm />
    </main>
  );
}
