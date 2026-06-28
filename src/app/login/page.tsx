"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signIn, type LoginState } from "./actions";
import { VAULT_TAB_KEY, VAULT_UNLOCK_KEY } from "@/lib/auth/vault";

const initialState: LoginState = { status: "idle" };

/**
 * Stamp the per-tab session markers the instant a sign-in is attempted. They
 * ride the same-tab navigation into the dashboard, where the vault gate reads
 * them: `tab` proves this tab authenticated (a reopened tab lacks it → forced
 * re-login); `unlock` triggers the one-shot vault-opening sequence.
 */
function markSignInAttempt() {
  try {
    sessionStorage.setItem(VAULT_TAB_KEY, "1");
    sessionStorage.setItem(VAULT_UNLOCK_KEY, "1");
  } catch {
    // sessionStorage unavailable — the gate fails closed to a re-login.
  }
}

/**
 * Sign-in screen. Carries the "The Bunker" wordmark at Tom's request; the page
 * still stays out of search engines (noindex/nofollow + generic title in the
 * sibling `layout.tsx`) and leaks nothing on failure (one generic error).
 */
export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <form action={formAction} className="w-full max-w-xs space-y-3">
        <div className="mb-8 flex flex-col items-center">
          <p className="display-serif pl-[0.42em] text-sm font-bold uppercase tracking-[0.42em] text-ink">
            The Bunker
          </p>
        </div>
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
        <Button
          type="submit"
          className="h-10 w-full"
          disabled={pending}
          onClick={markSignInAttempt}
        >
          {pending ? "…" : "Sign in"}
        </Button>
        {state.status === "error" && state.message && (
          <p className="text-center text-sm text-ink-3">{state.message}</p>
        )}
      </form>
    </main>
  );
}
