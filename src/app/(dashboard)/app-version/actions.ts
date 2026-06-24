"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createServiceClient } from "@/lib/supabase/admin";

export type ActionResult = { ok: true } | { ok: false; message: string };

/**
 * Set the minimum-version gate (Vestige-ios CLAUDE.md §3.8.2) for the active
 * environment. `min` is the hard floor (below it → blocking "update required"
 * wall); `recommended` drives the soft nudge; `updateUrl` is where both
 * "Update" buttons point. Service-role write (is_admin short-circuits for it),
 * gated by `requireAdmin()`.
 */
export async function setAppVersionConfig(
  min: string,
  recommended: string | null,
  updateUrl: string | null,
): Promise<ActionResult> {
  const trimmedMin = min.trim();
  if (!/^\d+(\.\d+)*$/.test(trimmedMin)) {
    return { ok: false, message: "Minimum version must be a dotted number like 0.2.3" };
  }

  await requireAdmin();

  let supabase;
  try {
    supabase = await createServiceClient();
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Service-role not configured" };
  }

  const { error } = await supabase.rpc("admin_set_app_version_config", {
    p_min_supported_version: trimmedMin,
    p_recommended_version: recommended?.trim() || null,
    p_update_url: updateUrl?.trim() || null,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/app-version");
  return { ok: true };
}
