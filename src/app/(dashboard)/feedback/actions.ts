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
 * throwing - `useFormState` callers branch on the shape and render
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

// Sets the operator work stage. The optional `note` only reaches the reporter
// on the two external stages (2026-06-09 split): for `inProgress` it's posted
// as a reply, for `fixed` it's stored as the resolution note. Internal stages
// ignore it. The SQL param is still named p_resolution_note.
export async function setWorkStage(
  reportId: string,
  stage: string,
  note: string | null,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createWriteClient();
  const { error } = await supabase.rpc("set_work_stage", {
    p_report_id: reportId,
    p_stage: stage,
    p_resolution_note: note || null,
  });
  if (error) {
    console.error("setWorkStage", error);
    return { error: error.message };
  }
  revalidatePath(`/feedback/${reportId}`);
  revalidatePath("/feedback");
  return { ok: true };
}

export async function setPriority(
  reportId: string,
  priority: string | null,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createWriteClient();
  const { error } = await supabase.rpc("set_priority", {
    p_report_id: reportId,
    p_priority: priority ?? "",
  });
  if (error) {
    console.error("setPriority", error);
    return { error: error.message };
  }
  revalidatePath(`/feedback/${reportId}`);
  revalidatePath("/feedback");
  return { ok: true };
}

export async function setOwner(
  reportId: string,
  ownerUserId: string | null,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createWriteClient();
  const { error } = await supabase.rpc("set_owner", {
    p_report_id: reportId,
    p_owner_user_id: ownerUserId,
  });
  if (error) {
    console.error("setOwner", error);
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

/**
 * Bulk-set the internal work stage on many reports at once (inbox bulk bar).
 * Restricted to INTERNAL stages so a bulk action can never mass-notify
 * reporters - the two external stages (In progress / Fixed) stay one-at-a-time
 * on the thread. Each report goes through the same `set_work_stage` RPC.
 */
export async function bulkSetWorkStage(
  reportIds: string[],
  stage: string,
): Promise<ActionResult> {
  await requireAdmin();
  if (reportIds.length === 0) return { ok: true };
  if (!["new", "triaged", "wontFix"].includes(stage)) {
    return { error: "Bulk stage is limited to New / Triaged / Won't fix." };
  }
  const supabase = await createWriteClient();
  const results = await Promise.all(
    reportIds.map((id) =>
      supabase.rpc("set_work_stage", {
        p_report_id: id,
        p_stage: stage,
        p_resolution_note: null,
      }),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    console.error("bulkSetWorkStage", failed.error);
    return { error: failed.error.message };
  }
  revalidatePath("/feedback");
  return { ok: true };
}

/** Bulk-set priority on many reports at once (inbox bulk bar). */
export async function bulkSetPriority(
  reportIds: string[],
  priority: string | null,
): Promise<ActionResult> {
  await requireAdmin();
  if (reportIds.length === 0) return { ok: true };
  const supabase = await createWriteClient();
  const results = await Promise.all(
    reportIds.map((id) =>
      supabase.rpc("set_priority", { p_report_id: id, p_priority: priority ?? "" }),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    console.error("bulkSetPriority", failed.error);
    return { error: failed.error.message };
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
