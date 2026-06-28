import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Admin gate for route handlers. Returns the active-env session client when the
 * caller is a signed-in admin, or a JSON error Response (401/403) otherwise.
 * The companion to `requireAdmin()` (which `redirect()`s - wrong for fetch()).
 */
export async function requireAdminApi(): Promise<
  { supabase: SupabaseClient; error?: never } | { supabase?: never; error: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  const role = await supabase.rpc("admin_role");
  if (role.error || !role.data) {
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { supabase };
}
