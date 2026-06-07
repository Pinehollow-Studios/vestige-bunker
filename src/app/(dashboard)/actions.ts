"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createDevClient, PROD_VIEW_COOKIE } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createDevClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Toggle read-only PROD VIEW. Sets/clears the `vestige_prod_view` cookie (read
 * server-side by `createClient`) — no relogin: the dev session + admin gate are
 * untouched, only page *reads* switch to prod (service-role). Redirects to the
 * overview so the surfaces re-fetch against the new source.
 */
export async function setProdView(on: boolean) {
  const store = await cookies();
  if (on) {
    store.set(PROD_VIEW_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
  } else {
    store.delete(PROD_VIEW_COOKIE);
  }
  redirect("/");
}
