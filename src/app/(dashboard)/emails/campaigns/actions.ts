"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import type { CampaignAudienceKind, CampaignTarget, CampaignRecipientRow } from "./types";

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; message: string };

/**
 * One-click "New email": create a fresh draft and drop the user straight into
 * the editor to write it. Named "Untitled email" (renameable in the editor) so
 * writing is a single click — no up-front naming gate. Everyone-audience draft,
 * so nothing sends until it's composed + sent/scheduled.
 */
export async function createDraftEmail(): Promise<ActionResult<string>> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("email_campaigns")
    .insert({
      name: "Untitled email",
      subject: "",
      html: "",
      audience_kind: "everyone",
      target: {},
      bypass_marketing_consent: false,
      status: "draft",
      created_by: admin.id,
    })
    .select("id")
    .single();

  if (error) return { ok: false, message: error.message };
  revalidatePath("/emails");
  redirect(`/emails/campaigns/${data.id}`);
}

export type CampaignPatch = {
  name?: string;
  subject?: string;
  preheader?: string | null;
  html?: string;
  audience_kind?: CampaignAudienceKind;
  min_app_version?: string | null;
  max_app_version?: string | null;
  bypass_marketing_consent?: boolean;
  target?: CampaignTarget;
};

/**
 * Patch draft / scheduled fields directly (RLS-gated). Refuses once the
 * campaign has sent — a sent campaign is a historical record.
 */
export async function updateCampaign(id: string, patch: CampaignPatch): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: current, error: readErr } = await supabase
    .from("email_campaigns")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (readErr) return { ok: false, message: readErr.message };
  if (!current) return { ok: false, message: "Campaign not found." };
  if (current.status === "sent" || current.status === "sending") {
    return { ok: false, message: "This campaign has already sent." };
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
  if (patch.min_app_version !== undefined) update.min_app_version = patch.min_app_version?.trim() || null;
  if (patch.max_app_version !== undefined) update.max_app_version = patch.max_app_version?.trim() || null;
  if (patch.bypass_marketing_consent !== undefined) update.bypass_marketing_consent = patch.bypass_marketing_consent;
  if (patch.target !== undefined) update.target = patch.target;

  if (Object.keys(update).length === 0) return { ok: true };

  const { error } = await supabase.from("email_campaigns").update(update).eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/emails");
  revalidatePath(`/emails/campaigns/${id}`);
  return { ok: true };
}

/** Queue delivery immediately. Returns the number of addresses queued. */
export async function sendCampaignNow(id: string): Promise<ActionResult<number>> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_send_email_campaign", { p_id: id });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/emails");
  revalidatePath(`/emails/campaigns/${id}`);
  return { ok: true, data: (data as number) ?? 0 };
}

/** Schedule (or reschedule) for a future time. `whenISO` is a UTC ISO string. */
export async function scheduleCampaign(id: string, whenISO: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_schedule_email_campaign", { p_id: id, p_when: whenISO });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/emails");
  revalidatePath(`/emails/campaigns/${id}`);
  return { ok: true };
}

/** Cancel a not-yet-sent campaign. */
export async function cancelCampaign(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_cancel_email_campaign", { p_id: id });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/emails");
  revalidatePath(`/emails/campaigns/${id}`);
  return { ok: true };
}

/** Hard delete — super_admin only (mirrors deleteBroadcast). */
export async function deleteCampaign(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (admin.role !== "super_admin") {
    return { ok: false, message: "Delete requires super_admin." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("email_campaigns").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/emails");
  redirect("/emails");
}

/** Replace the hand-picked recipient set (individuals targeting). */
export async function setCampaignTargets(id: string, userIds: string[]): Promise<ActionResult> {
  await requireAdmin();
  const unique = Array.from(new Set(userIds.filter((u) => isUuid(u))));
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_email_campaign_targets", { p_id: id, p_user_ids: unique });
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/emails/campaigns/${id}`);
  return { ok: true };
}

/** The per-recipient delivery log for a campaign (results panel). */
export async function loadCampaignRecipients(id: string): Promise<ActionResult<CampaignRecipientRow[]>> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_email_campaign_recipients", { p_id: id });
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: (data as CampaignRecipientRow[] | null) ?? [] };
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
