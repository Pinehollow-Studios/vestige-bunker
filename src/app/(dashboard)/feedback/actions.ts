"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createWriteClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";

/**
 * Server actions backing the feedback triage workflow (slice 4 of
 * the build-out). Every action gates via `requireAdmin()` first;
 * the SECURITY DEFINER RPCs re-assert admin role server-side
 * regardless. Each action revalidates the affected paths so the
 * UI reflects the new state on the next render.
 *
 * Errors come back as { error: string } objects rather than
 * throwing — `useFormState` callers branch on the shape and render
 * a toast + error message inline. The dashboard's existing pattern
 * (see `lists/actions.ts`).
 */

type ActionResult = { ok: true } | { error: string };

export async function revalidateFeedback(): Promise<void> {
  revalidatePath("/feedback");
}

export async function postReply(
  reportId: string,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createWriteClient();
  const body = (formData.get("body") as string | null)?.trim();
  const attachmentPath = formData.get("attachment_storage_path") as
    | string
    | null;

  if (!body) {
    return { error: "Write a reply before sending." };
  }

  const { error } = await supabase.rpc("post_admin_message", {
    p_report_id: reportId,
    p_body: body,
    p_attachment_storage_path: attachmentPath || null,
  });
  if (error) {
    console.error("postReply", error);
    return { error: error.message };
  }
  revalidatePath(`/feedback/${reportId}`);
  revalidatePath("/feedback");
  return { ok: true };
}

export async function transitionStatus(
  reportId: string,
  newStatus: string,
  resolutionNote: string | null,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createWriteClient();
  const { error } = await supabase.rpc("transition_status", {
    p_report_id: reportId,
    p_new_status: newStatus,
    p_resolution_note: resolutionNote || null,
  });
  if (error) {
    console.error("transitionStatus", error);
    return { error: error.message };
  }
  revalidatePath(`/feedback/${reportId}`);
  revalidatePath("/feedback");
  return { ok: true };
}

export async function setSeverity(
  reportId: string,
  severity: string | null,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createWriteClient();
  const { error } = await supabase.rpc("set_severity", {
    p_report_id: reportId,
    p_severity: severity ?? "",
  });
  if (error) {
    console.error("setSeverity", error);
    return { error: error.message };
  }
  revalidatePath(`/feedback/${reportId}`);
  revalidatePath("/feedback");
  return { ok: true };
}

export async function setTags(
  reportId: string,
  tags: string[],
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createWriteClient();
  const { error } = await supabase.rpc("set_tags", {
    p_report_id: reportId,
    p_tags: tags,
  });
  if (error) {
    console.error("setTags", error);
    return { error: error.message };
  }
  revalidatePath(`/feedback/${reportId}`);
  revalidatePath("/feedback");
  return { ok: true };
}

export async function markDuplicateOf(
  reportId: string,
  canonicalReportId: string,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createWriteClient();
  const { error } = await supabase.rpc("mark_duplicate_of", {
    p_report_id: reportId,
    p_canonical_report_id: canonicalReportId,
  });
  if (error) {
    console.error("markDuplicateOf", error);
    return { error: error.message };
  }
  revalidatePath(`/feedback/${reportId}`);
  revalidatePath(`/feedback/${canonicalReportId}`);
  revalidatePath("/feedback");
  return { ok: true };
}

export async function blockReporter(
  userId: string,
  reason: string | null,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createWriteClient();
  const { error } = await supabase.rpc("block_reporter", {
    p_user_id: userId,
    p_reason: reason || null,
  });
  if (error) {
    console.error("blockReporter", error);
    return { error: error.message };
  }
  revalidatePath("/feedback");
  return { ok: true };
}

export async function unblockReporter(
  userId: string,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createWriteClient();
  const { error } = await supabase.rpc("unblock_reporter", {
    p_user_id: userId,
  });
  if (error) {
    console.error("unblockReporter", error);
    return { error: error.message };
  }
  revalidatePath("/feedback");
  return { ok: true };
}

export async function bulkResolve(
  reportIds: string[],
  resolutionNote: string,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (admin.role !== "super_admin") {
    return { error: "Bulk-resolve requires super_admin." };
  }
  if (!resolutionNote.trim()) {
    return { error: "Resolution note is required for bulk-resolve." };
  }
  const supabase = await createWriteClient();
  const { error } = await supabase.rpc("bulk_resolve_reports", {
    p_report_ids: reportIds,
    p_resolution_note: resolutionNote,
  });
  if (error) {
    console.error("bulkResolve", error);
    return { error: error.message };
  }
  revalidatePath("/feedback");
  return { ok: true };
}

export async function deleteReport(
  reportId: string,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (admin.role !== "super_admin") {
    return { error: "Delete requires super_admin." };
  }
  const supabase = await createWriteClient();
  const { error } = await supabase.rpc("delete_feedback_report", {
    p_report_id: reportId,
  });
  if (error) {
    console.error("deleteReport", error);
    return { error: error.message };
  }
  revalidatePath("/feedback");
  redirect("/feedback");
}
