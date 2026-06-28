"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export type ActionResult = { ok: true } | { ok: false; message: string };

export type AccountStatus = "active" | "restricted" | "suspended";

/**
 * Admin actions on a user, all backed by the existing `is_admin()`-gated
 * SECURITY DEFINER RPCs (safeguarding migrations). They run on the SESSION
 * client so the action is attributed to the signed-in admin and the RPC's own
 * role checks apply (suspend is super_admin-only - the RPC enforces it).
 */

export async function setAccountStatus(
  userId: string,
  status: AccountStatus,
  reason?: string,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_account_status", {
    p_user_id: userId,
    p_new_status: status,
    p_reason: reason?.trim() || null,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/users/${userId}`);
  revalidatePath("/safeguarding");
  return { ok: true };
}

export async function setLeaderboardHidden(
  userId: string,
  hidden: boolean,
  reason?: string,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = hidden
    ? await supabase.rpc("admin_hide_user_from_public_leaderboards", {
        p_user_id: userId,
        p_reason: reason?.trim() || null,
      })
    : await supabase.rpc("admin_unhide_user_from_public_leaderboards", { p_user_id: userId });
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/users/${userId}`);
  return { ok: true };
}

export async function messageUser(userId: string, body: string): Promise<ActionResult> {
  await requireAdmin();
  if (!body.trim()) return { ok: false, message: "Write a message first." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_message_user_about_safeguarding", {
    p_user_id: userId,
    p_body: body.trim(),
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/users/${userId}`);
  return { ok: true };
}
