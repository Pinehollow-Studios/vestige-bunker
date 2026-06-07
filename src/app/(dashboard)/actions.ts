"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEV_SWITCH_ENABLED, ENV_COOKIE, type AdminEnvKey } from "@/lib/supabase/env";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Hidden developer-only environment switch. Points the whole dashboard (data +
 * auth) at dev or prod by setting the `vestige_env` cookie. No-op unless the
 * dev switch is enabled (local + Preview only — never the production build).
 * Redirects to the overview so every surface re-fetches against the new source;
 * the active env's own session cookie drives auth, so switching may land on the
 * login screen for that environment.
 */
export async function setEnv(env: AdminEnvKey) {
  if (!DEV_SWITCH_ENABLED) return;
  const store = await cookies();
  if (env === "dev") {
    store.set(ENV_COOKIE, "dev", {
      httpOnly: false, // read client-side by supabase/client.ts too
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
  } else {
    store.delete(ENV_COOKIE);
  }
  redirect("/");
}
