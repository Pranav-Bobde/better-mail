"use client";

import { Loader2 } from "lucide-react";
import * as React from "react";

import { Button } from "@code-main/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@code-main/ui/components/card";

import { authClient } from "@/shared/utils/auth-client";

export function LoginForm() {
  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState("");

  async function signInWithGoogle() {
    setIsPending(true);
    setError("");

    const result = await authClient.signIn.social({
      callbackURL: "/",
      errorCallbackURL: "/login",
      provider: "google",
    });

    if (result.error) {
      setError(result.error.message ?? "Google sign in failed.");
      setIsPending(false);
    }
  }

  return (
    <Card className="w-full max-w-sm rounded-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-lg">Sign in to Mail</CardTitle>
        <CardDescription>Use Google to connect Gmail.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Button className="w-full" disabled={isPending} onClick={() => void signInWithGoogle()}>
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <GoogleIcon />}
          Continue with Google
        </Button>
        {error ? <p className="text-center text-xs text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24">
      <path
        d="M21.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.4a4.7 4.7 0 0 1-2 3.1v2.6h3.3a10 10 0 0 0 2.9-7.7z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.7 0 5-.9 6.7-2.5l-3.3-2.6c-.9.6-2.1 1-3.4 1a6 6 0 0 1-5.7-4.1H2.9v2.7A10 10 0 0 0 12 22z"
        fill="#34A853"
      />
      <path
        d="M6.3 13.8A6.3 6.3 0 0 1 6 12c0-.6.1-1.2.3-1.8V7.5H2.9A10 10 0 0 0 2 12c0 1.6.3 3.1.9 4.5l3.4-2.7z"
        fill="#FBBC05"
      />
      <path
        d="M12 6.1c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.7 9.7 0 0 0 12 2a10 10 0 0 0-9.1 5.5l3.4 2.7A6 6 0 0 1 12 6.1z"
        fill="#EA4335"
      />
    </svg>
  );
}
