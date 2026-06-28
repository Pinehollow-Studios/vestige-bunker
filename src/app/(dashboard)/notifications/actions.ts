"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { sanitizeFilterValue } from "@/lib/security/postgrest";
import type { BroadcastAudienceKind, BroadcastTarget, UserPickRow } from "./types";

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; message: string };

/**
 * Create a fresh draft broadcast and redirect into its editor. Starts as an
 * everyone-audience draft so nothing fires until the admin composes it and hits
 * Send (or schedules it).
 */
export async function createBroadcast(title: string): Promise<ActionResult<string>> {
  const trimmed = title.trim();
  if (!trimmed) return { ok: false, message: "Title is required." };

  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("admin_broadcasts")
    .insert({
      title: trimmed,
      body: "",
      audience_kind: "everyone",
      target: {},
      is_critical: false,
      status: "draft",
      created_by: admin.id,
    })
    .select("id")
    .single();

  if (error) return { ok: false, message: error.message };
  revalidatePath("/notifications");
  redirect(`/notifications/${data.id}`);
}

export type BroadcastPatch = {
  title?: string;
  body?: string;
  destination_url?: string | null;
  audience_kind?: BroadcastAudienceKind;
  min_app_version?: string | null;
  max_app_version?: string | null;
  is_critical?: boolean;
  target?: BroadcastTarget;
};

/**
 * Patch draft / scheduled fields directly (RLS-gated). Refuses once the
 * broadcast has sent - use `editSentCopy` for that (it also rewrites the
 * delivered inbox rows).
 */
export async function updateBroadcast(id: string, patch: BroadcastPatch): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  // Guard: only mutate a not-yet-sent broadcast through here.
  const { data: current, error: readErr } = await supabase
    .from("admin_broadcasts")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (readErr) return { ok: false, message: readErr.message };
  if (!current) return { ok: false, message: "Broadcast not found." };
  if (current.status === "sent" || current.status === "sending") {
    return { ok: false, message: "This broadcast has sent - edit its in-app copy instead." };
  }

  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (!t) return { ok: false, message: "Title can't be empty." };
    update.title = t;
  }
  if (patch.body !== undefined) update.body = patch.body.trim();
  if (patch.destination_url !== undefined) update.destination_url = patch.destination_url?.trim() || null;
  if (patch.audience_kind !== undefined) update.audience_kind = patch.audience_kind;
  if (patch.min_app_version !== undefined) update.min_app_version = patch.min_app_version?.trim() || null;
  if (patch.max_app_version !== undefined) update.max_app_version = patch.max_app_version?.trim() || null;
  if (patch.is_critical !== undefined) update.is_critical = patch.is_critical;
  if (patch.target !== undefined) update.target = patch.target;

  if (Object.keys(update).length === 0) return { ok: true };

  const { error } = await supabase.from("admin_broadcasts").update(update).eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/notifications");
  revalidatePath(`/notifications/${id}`);
  return { ok: true };
}

/** Deliver immediately. Returns the delivered recipient count. */
export async function sendBroadcastNow(id: string): Promise<ActionResult<number>> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_send_broadcast", { p_id: id });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/notifications");
  revalidatePath(`/notifications/${id}`);
  return { ok: true, data: (data as number) ?? 0 };
}

/** Schedule (or reschedule) for a future time. `whenISO` is a UTC ISO string. */
export async function scheduleBroadcast(id: string, whenISO: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_schedule_broadcast", { p_id: id, p_when: whenISO });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/notifications");
  revalidatePath(`/notifications/${id}`);
  return { ok: true };
}

/** Cancel a not-yet-sent broadcast. */
export async function cancelBroadcast(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_cancel_broadcast", { p_id: id });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/notifications");
  revalidatePath(`/notifications/${id}`);
  return { ok: true };
}

/**
 * Edit the in-app copy of an already-sent broadcast - updates the source row +
 * every delivered inbox notification (the lock-screen alert already landed and
 * can't change). Returns the number of inbox rows rewritten.
 */
export async function editSentCopy(
  id: string,
  title: string,
  body: string,
  destinationURL: string | null,
): Promise<ActionResult<number>> {
  await requireAdmin();
  const t = title.trim();
  const b = body.trim();
  if (!t || !b) return { ok: false, message: "Title and body are required." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_edit_broadcast_copy", {
    p_id: id,
    p_title: t,
    p_body: b,
    p_destination_url: destinationURL?.trim() || null,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/notifications");
  revalidatePath(`/notifications/${id}`);
  return { ok: true, data: (data as number) ?? 0 };
}

/** Hard delete - super_admin only. */
export async function deleteBroadcast(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (admin.role !== "super_admin") {
    return { ok: false, message: "Delete requires super_admin." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("admin_broadcasts").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/notifications");
  redirect("/notifications");
}

/** Replace the hand-picked recipient set (individuals targeting). */
export async function setBroadcastTargets(id: string, userIds: string[]): Promise<ActionResult> {
  await requireAdmin();
  const unique = Array.from(new Set(userIds.filter((u) => isUuid(u))));
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_broadcast_targets", { p_id: id, p_user_ids: unique });
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/notifications/${id}`);
  return { ok: true };
}

/** Search users by username / display name for the individuals picker. */
export async function searchUsers(query: string): Promise<ActionResult<UserPickRow[]>> {
  await requireAdmin();
  const q = sanitizeFilterValue(query);
  if (q.length < 2) return { ok: true, data: [] };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, username, display_name, avatar_photo_id")
    .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
    .order("username", { ascending: true })
    .limit(20);
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: (data ?? []) as UserPickRow[] };
}

// ── Notification copy templates ─────────────────────────────────────────

export type NotificationTemplateRow = {
  kind: string;
  push_title: string | null;
  push_body: string | null;
  inbox_title: string | null;
  inbox_body: string | null;
  updated_at: string;
  updated_by: string | null; // null = seeded default; set = admin-customised
};

/** All overridden templates (kinds with no override simply aren't returned). */
export async function loadNotificationTemplates(): Promise<ActionResult<NotificationTemplateRow[]>> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_notification_templates");
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: (data as NotificationTemplateRow[] | null) ?? [] };
}

/**
 * Upsert a kind's copy template (blank field → revert that field to the
 * built-in default). Retro-rewrites the in-app copy of already-delivered rows.
 * Returns how many inbox rows were rewritten.
 */
export async function saveNotificationTemplate(
  kind: string,
  pushTitle: string,
  pushBody: string,
  inboxTitle: string,
  inboxBody: string,
  isDefault = false,
): Promise<ActionResult<number>> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_notification_template", {
    p_kind: kind,
    p_push_title: pushTitle.trim() || null,
    p_push_body: pushBody.trim() || null,
    p_inbox_title: inboxTitle.trim() || null,
    p_inbox_body: inboxBody.trim() || null,
    p_is_default: isDefault,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/notifications");
  return { ok: true, data: (data as number) ?? 0 };
}

// ── Helpers ─────────────────────────────────────────────────────────────

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
