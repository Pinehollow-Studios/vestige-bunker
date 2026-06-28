"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signIn, type LoginState } from "./actions";

const initialState: LoginState = { status: "idle" };

/**
 * Deliberately anonymous sign-in. No branding, headings, help text, or product
 * name - a stranger who stumbles onto the page should learn nothing about what
 * it guards. Just two fields and a button. (The page title + noindex live in
 * the sibling `layout.tsx`.)
 */
export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <form action={formAction} className="w-full max-w-xs space-y-3">
        <Input
          name="email"
          type="email"
          autoComplete="email"
          aria-label="Email"
          placeholder="Email"
          required
          autoFocus
          className="h-10"
        />
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          aria-label="Password"
          placeholder="Password"
          required
          className="h-10"
        />
        <Button type="submit" className="h-10 w-full" disabled={pending}>
          {pending ? "…" : "Sign in"}
        </Button>
        {state.status === "error" && state.message && (
          <p className="text-center text-sm text-ink-3">{state.message}</p>
        )}
      </form>
    </main>
  );
}
