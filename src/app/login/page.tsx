"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/admin/Sidebar";
import { signIn, type LoginState } from "./actions";

const initialState: LoginState = { status: "idle" };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <main className="relative grid min-h-dvh lg:grid-cols-2">
      {/* Left: branded panel — deep brand green with subtle topo. */}
      <aside
        className="relative hidden flex-col justify-between overflow-hidden p-12 text-brand-fg lg:flex"
        style={{
          background:
            "linear-gradient(135deg, var(--brand-deep) 0%, var(--brand) 70%, color-mix(in oklab, var(--brand) 65%, var(--brand-soft)) 100%)",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 80% 10%, rgba(251,246,232,0.35) 0%, transparent 55%)," +
              "radial-gradient(circle at 5% 100%, rgba(251,246,232,0.25) 0%, transparent 60%)",
          }}
        />
        <div className="relative flex items-center gap-3">
          <BrandMark className="size-10" />
          <div className="leading-tight">
            <p className="font-heading text-lg font-semibold tracking-tight">
              Vestige
            </p>
            <p className="text-[11px] uppercase tracking-[0.18em] text-brand-fg/70">
              Admin
            </p>
          </div>
        </div>
        <div className="relative space-y-3 max-w-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-fg/65">
            Editorial &amp; ops
          </p>
          <h1 className="display-serif text-4xl font-semibold leading-tight">
            The almanac, kept tidy.
          </h1>
          <p className="text-sm text-brand-fg/85">
            Verifying lists, moderating photos, curating editorial collections —
            everything Vestige needs from the inside.
          </p>
        </div>
        <p className="relative text-[11px] uppercase tracking-[0.2em] text-brand-fg/55">
          Pinehollow Studios
        </p>
      </aside>

      {/* Right: sign-in card on cream paper. */}
      <section className="relative flex items-center justify-center p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "radial-gradient(circle at 100% 0%, color-mix(in oklab, var(--brand) 8%, transparent) 0%, transparent 60%)",
          }}
        />
        <div className="relative w-full max-w-sm space-y-6">
          <div className="space-y-2 lg:hidden">
            <BrandMark className="size-10" />
            <p className="font-heading text-base font-semibold">Vestige Admin</p>
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
              Sign in
            </p>
            <h2 className="display-serif text-3xl font-semibold leading-tight text-ink">
              Welcome back
            </h2>
            <p className="text-sm text-ink-2">
              Use your admin credentials. Access is gated against the
              <span className="font-semibold"> admins</span> table.
            </p>
          </div>

          <form action={formAction} className="space-y-4 rounded-2xl border border-border bg-paper-raised p-6">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-ink-2">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@pinehollow.studio"
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-ink-2">
                Password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="h-10"
              />
            </div>
            <Button
              type="submit"
              className="h-10 w-full bg-brand text-brand-fg hover:bg-brand-deep"
              disabled={pending}
            >
              {pending ? "Signing in…" : "Sign in"}
            </Button>
            {state.status === "error" && state.message && (
              <p className="rounded-lg border border-alert/30 bg-alert/10 px-3 py-2 text-sm text-alert">
                {state.message}
              </p>
            )}
          </form>

          <p className="text-[11px] text-ink-3">
            Trouble signing in? Ask Tom or Jack — they can grant or refresh access.
          </p>
        </div>
      </section>
    </main>
  );
}
