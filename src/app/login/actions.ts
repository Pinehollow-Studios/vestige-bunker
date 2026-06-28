"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createDevClient } from "@/lib/supabase/server";

export type LoginState = {
  status: "idle" | "error";
  message?: string;
};

/**
 * In-memory brute-force throttle. CAVEAT: this is per server *instance* - on
 * serverless (Vercel) each instance keeps its own Map, so it's a best-effort
 * speed bump, not a guarantee. Supabase Auth's own rate-limiting is the real
 * backstop; a shared store (Vercel KV / Upstash) is the proper cross-instance
 * fix and is tracked in SECURITY.md. Keyed by IP+email so one attacker can't
 * lock out a victim globally, and cleared on a successful sign-in.
 */
const MAX_FAILURES = 8;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; resetAt: number }>();

function allowed(key: string): boolean {
  const rec = attempts.get(key);
  return !rec || rec.resetAt < Date.now() || rec.count < MAX_FAILURES;
}

function recordFailure(key: string): void {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || rec.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    rec.count += 1;
  }
  // Opportunistic prune so the map can't grow unbounded under attack.
  if (attempts.size > 5000) {
    for (const [k, v] of attempts) if (v.resetAt < now) attempts.delete(k);
  }
}

export async function signIn(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { status: "error", message: "Incorrect email or password." };
  }

  const hdrs = await headers();
  const ip = (hdrs.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "unknown";
  const key = `${ip}:${email.toLowerCase()}`;

  if (!allowed(key)) {
    return { status: "error", message: "Too many attempts. Try again later." };
  }

  const supabase = await createDevClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    recordFailure(key);
    // Deliberately generic - never leak whether the email exists, the admin
    // gate, rate limits, or any Supabase internals to an anonymous visitor.
    return { status: "error", message: "Incorrect email or password." };
  }

  attempts.delete(key);
  redirect("/");
}
