"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import type { WaitlistSubscriberRow } from "./types";

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; message: string };

/**
 * One-click "New waitlist email": create a fresh draft and drop the user into
 * the editor. A waitlist campaign always targets every subscribed address — no
 * audience gate — so there's nothing to configure up front.
 */
export async function createDraftWaitlistEmail(): Promise<ActionResult<string>> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("waitlist_campaigns")
    .insert({ name: "Untitled email", subject: "", html: "", status: "draft", created_by: admin.id })
    .select("id")
    .single();

  if (error) return { ok: false, message: error.message };
  revalidatePath("/emails");
  redirect(`/emails/waitlist/${data.id}`);
}

export type WaitlistCampaignPatch = {
  name?: string;
  subject?: string;
  preheader?: string | null;
  html?: string;
  audience_kind?: "everyone" | "individuals";
};

/** Patch draft / scheduled fields directly (RLS-gated). Refuses once sent. */
export async function updateWaitlistCampaign(
  id: string,
  patch: WaitlistCampaignPatch,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: current, error: readErr } = await supabase
    .from("waitlist_campaigns").select("status").eq("id", id).maybeSingle();
  if (readErr) return { ok: false, message: readErr.message };
  if (!current) return { ok: false, message: "Campaign not found." };
  if (current.status === "sent" || current.status === "sending") {
    return { ok: false, message: "This email has already sent." };
  }

  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const n = patch.name.trim();
    if (!n) return { ok: false, message: "Name can't be empty." };
    update.name = n;
  }
  if (patch.subject !== undefined) update.subject = patch.subject.trim();
  if (patch.preheader !== undefined) update.preheader = patch.preheader?.trim() || null;
  if (patch.html !== undefined) update.html = patch.html;
  if (patch.audience_kind !== undefined) update.audience_kind = patch.audience_kind;

  if (Object.keys(update).length === 0) return { ok: true };

  const { error } = await supabase.from("waitlist_campaigns").update(update).eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/emails");
  revalidatePath(`/emails/waitlist/${id}`);
  return { ok: true };
}

/** Queue delivery immediately. Returns the number of addresses queued. */
export async function sendWaitlistNow(id: string): Promise<ActionResult<number>> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_send_waitlist_campaign", { p_id: id });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/emails");
  revalidatePath(`/emails/waitlist/${id}`);
  return { ok: true, data: (data as number) ?? 0 };
}

/** Schedule (or reschedule) for a future time. `whenISO` is a UTC ISO string. */
export async function scheduleWaitlist(id: string, whenISO: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_schedule_waitlist_campaign", { p_id: id, p_when: whenISO });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/emails");
  revalidatePath(`/emails/waitlist/${id}`);
  return { ok: true };
}

/** Cancel a not-yet-sent campaign. */
export async function cancelWaitlist(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_cancel_waitlist_campaign", { p_id: id });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/emails");
  revalidatePath(`/emails/waitlist/${id}`);
  return { ok: true };
}

/**
 * Delete a draft (or canceled) waitlist email from the list — any admin, no
 * redirect. Refuses anything sent/scheduled/sending. For clearing list clutter.
 */
export async function deleteDraftWaitlist(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { data: current, error: readErr } = await supabase
    .from("waitlist_campaigns").select("status").eq("id", id).maybeSingle();
  if (readErr) return { ok: false, message: readErr.message };
  if (!current) return { ok: true };
  if (current.status !== "draft" && current.status !== "canceled") {
    return { ok: false, message: "Only drafts can be deleted from here." };
  }
  const { error } = await supabase.from("waitlist_campaigns").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/emails");
  return { ok: true };
}

/** Hard delete — super_admin only (mirrors deleteCampaign). */
export async function deleteWaitlist(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (admin.role !== "super_admin") return { ok: false, message: "Delete requires super_admin." };
  const supabase = await createClient();
  const { error } = await supabase.from("waitlist_campaigns").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/emails");
  redirect("/emails");
}

/**
 * Pull the existing Resend contacts into `waitlist_subscribers` (the
 * import-waitlist Edge Function, gated on the caller's admin JWT). Idempotent —
 * safe to run repeatedly. Returns how many rows were imported.
 */
export async function importWaitlistFromResend(): Promise<ActionResult<{ imported: number; total: number }>> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke("import-waitlist", { body: {} });
  if (error) return { ok: false, message: error.message };
  const body = data as { skipped?: string; imported?: number; total?: number; error?: string } | null;
  if (body?.skipped === "resend_not_configured") {
    return { ok: false, message: "Resend isn’t configured on this environment yet." };
  }
  if (body?.error) return { ok: false, message: body.error };
  revalidatePath("/emails");
  return { ok: true, data: { imported: body?.imported ?? 0, total: body?.total ?? 0 } };
}

export type ImportRow = {
  email: string;
  first_name?: string | null;
  source?: string | null;
  unsubscribed?: boolean;
};

/**
 * Import a parsed CSV (Resend contacts export) into `waitlist_subscribers`. The
 * reliable path — no full-access Resend key needed. The RPC is service-role only,
 * so this runs via the active env's service client. Idempotent (upsert by email).
 */
export async function importWaitlistCsv(
  rows: ImportRow[],
): Promise<ActionResult<{ imported: number; total: number }>> {
  await requireAdmin();
  const clean = rows
    .filter((r) => typeof r.email === "string" && r.email.includes("@"))
    .slice(0, 20000);
  if (clean.length === 0) return { ok: false, message: "No valid email rows found in that CSV." };

  const payload = clean.map((r) => ({
    email: r.email.trim().toLowerCase(),
    first_name: r.first_name?.trim() || null,
    source: r.source?.trim() || "csv_import",
    unsubscribed: r.unsubscribed === true,
    resend_contact_id: null,
  }));

  const svc = await createServiceClient();
  const { data, error } = await svc.rpc("import_waitlist_subscribers", { p_rows: payload });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/emails");
  return { ok: true, data: { imported: (data as number) ?? 0, total: clean.length } };
}

/** Load subscriber rows (search-filtered, paginated) for the live list + picker. */
export async function loadWaitlistSubscribers(
  search?: string,
  limit = 100,
  offset = 0,
): Promise<ActionResult<WaitlistSubscriberRow[]>> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_waitlist_subscribers", {
    p_limit: Math.min(Math.max(1, limit), 500),
    p_offset: Math.max(0, offset),
    p_search: search?.trim() || null,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: (data as WaitlistSubscriberRow[] | null) ?? [] };
}

/** Live headline counts for the auto-refreshing overview. */
export async function loadWaitlistOverview(): Promise<
  ActionResult<{ total: number; subscribed: number; unsubscribed: number; new_7d: number; new_30d: number }>
> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_waitlist_overview");
  if (error) return { ok: false, message: error.message };
  const o = data?.[0] ?? { total: 0, subscribed: 0, unsubscribed: 0, new_7d: 0, new_30d: 0 };
  return { ok: true, data: o };
}

/** Replace the hand-picked recipient set for an individuals-targeted campaign. */
export async function setWaitlistCampaignTargets(id: string, emails: string[]): Promise<ActionResult> {
  await requireAdmin();
  const clean = Array.from(new Set(emails.map((e) => e.trim().toLowerCase()).filter((e) => e.includes("@"))));
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_waitlist_campaign_targets", { p_id: id, p_emails: clean });
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/emails/waitlist/${id}`);
  return { ok: true };
}
