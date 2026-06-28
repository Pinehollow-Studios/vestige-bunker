"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { FEEDBACK_ACTIVE_WORK_STAGES } from "@/lib/feedback/types";
import { type ChangeKind, parseVersion } from "./types";

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; message: string };

/** A trimmed feedback row for the link picker (from admin_feedback_queue). */
export type FeedbackSearchRow = {
  id: string;
  kind: string;
  status: string;
  body_preview: string;
};

function revalidateVersion(id: string) {
  revalidatePath("/changelog");
  revalidatePath(`/changelog/${id}`);
}

function isUniqueViolation(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("duplicate") || m.includes("unique") || m.includes("already exists");
}

// ── Versions ────────────────────────────────────────────────────────────

/**
 * Create a fresh version (defaults to a draft) and redirect into its editor.
 * The display string is parsed into major/minor/patch for ordering; both
 * `version` and the (major,minor,patch) tuple are unique in the DB, so a repeat
 * is reported rather than silently duplicated.
 */
export async function createVersion(version: string): Promise<ActionResult<string>> {
  const parsed = parseVersion(version);
  if (!parsed) {
    return { ok: false, message: "Use a version like 0.1.2 (or 0.1)." };
  }

  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("app_versions")
    .insert({
      version: parsed.version,
      major: parsed.major,
      minor: parsed.minor,
      patch: parsed.patch,
      status: "draft",
      created_by_admin_id: admin.id,
      last_edited_by_admin_id: admin.id,
    })
    .select("id")
    .single();

  if (error) {
    if (isUniqueViolation(error.message)) {
      return { ok: false, message: `Version ${parsed.version} already exists.` };
    }
    return { ok: false, message: error.message };
  }
  revalidatePath("/changelog");
  redirect(`/changelog/${data.id}`);
}

export type VersionPatch = {
  version?: string;
  title?: string | null;
  summary?: string | null;
};

/**
 * Patch a version's editorial fields. Changing `version` re-parses
 * major/minor/patch so ordering stays correct. Empty strings on the optional
 * text fields coerce to null; `updated_at` is set by the table trigger.
 */
export async function updateVersion(
  id: string,
  patch: VersionPatch,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const update: Record<string, unknown> = {};

  if (patch.version !== undefined) {
    const parsed = parseVersion(patch.version);
    if (!parsed) return { ok: false, message: "Use a version like 0.1.2 (or 0.1)." };
    update.version = parsed.version;
    update.major = parsed.major;
    update.minor = parsed.minor;
    update.patch = parsed.patch;
  }
  if (patch.title !== undefined) update.title = patch.title?.trim() || null;
  if (patch.summary !== undefined) update.summary = patch.summary?.trim() || null;

  if (Object.keys(update).length === 0) return { ok: true };
  update.last_edited_by_admin_id = admin.id;

  const { error } = await supabase.from("app_versions").update(update).eq("id", id);
  if (error) {
    if (isUniqueViolation(error.message)) {
      return { ok: false, message: "That version number is already taken." };
    }
    return { ok: false, message: error.message };
  }
  revalidateVersion(id);
  return { ok: true };
}

/**
 * Flip a version between draft and released. Releasing stamps `released_at`
 * with now() when it isn't already set; reverting to draft leaves the recorded
 * date in place (it's editable on its own). The date itself can be overridden
 * via setReleasedAt.
 */
export async function setReleased(
  id: string,
  released: boolean,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const update: Record<string, unknown> = {
    status: released ? "released" : "draft",
    last_edited_by_admin_id: admin.id,
  };
  if (released) {
    const { data } = await supabase
      .from("app_versions")
      .select("released_at")
      .eq("id", id)
      .maybeSingle();
    if (!data?.released_at) update.released_at = new Date().toISOString();
  }

  const { error } = await supabase.from("app_versions").update(update).eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateVersion(id);
  return { ok: true };
}

/** Set (or clear) the release date directly. `null` clears it. */
export async function setReleasedAt(
  id: string,
  releasedAt: string | null,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("app_versions")
    .update({ released_at: releasedAt, last_edited_by_admin_id: admin.id })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateVersion(id);
  return { ok: true };
}

/** Hard delete a version (cascades its change lines) - super_admin only. */
export async function deleteVersion(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (admin.role !== "super_admin") {
    return { ok: false, message: "Delete requires super_admin." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("app_versions").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/changelog");
  redirect("/changelog");
}

// ── Change lines ──────────────────────────────────────────────────────────

/**
 * Append a change line to a version (sorts after the existing lines). An
 * optional `feedbackReportId` tags the new line to a report in the same insert,
 * so a line can be born already linked (no separate link step).
 */
export async function addChange(
  versionId: string,
  kind: ChangeKind,
  summary: string,
  feedbackReportId?: string | null,
): Promise<ActionResult<string>> {
  const text = summary.trim();
  if (!text) return { ok: false, message: "Write the change first." };

  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data: last } = await supabase
    .from("app_version_changes")
    .select("sort_index")
    .eq("version_id", versionId)
    .order("sort_index", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSort = (last?.sort_index ?? -1) + 1;

  const { data, error } = await supabase
    .from("app_version_changes")
    .insert({
      version_id: versionId,
      kind,
      summary: text,
      sort_index: nextSort,
      feedback_report_id: feedbackReportId ?? null,
      created_by_admin_id: admin.id,
    })
    .select("id")
    .single();

  if (error) return { ok: false, message: error.message };
  revalidateVersion(versionId);
  if (feedbackReportId) {
    revalidatePath(`/feedback/${feedbackReportId}`);
    revalidatePath("/feedback");
  }
  return { ok: true, data: data.id };
}

export type ChangePatch = { kind?: ChangeKind; summary?: string };

export async function updateChange(
  versionId: string,
  changeId: string,
  patch: ChangePatch,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const update: Record<string, unknown> = {};
  if (patch.kind !== undefined) update.kind = patch.kind;
  if (patch.summary !== undefined) {
    const text = patch.summary.trim();
    if (!text) return { ok: false, message: "A change line can't be empty." };
    update.summary = text;
  }
  if (Object.keys(update).length === 0) return { ok: true };

  const { error } = await supabase
    .from("app_version_changes")
    .update(update)
    .eq("id", changeId);
  if (error) return { ok: false, message: error.message };
  revalidateVersion(versionId);
  return { ok: true };
}

export async function deleteChange(
  versionId: string,
  changeId: string,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("app_version_changes")
    .delete()
    .eq("id", changeId);
  if (error) return { ok: false, message: error.message };
  revalidateVersion(versionId);
  return { ok: true };
}

/**
 * Persist a new line order for a version. The editor sends the full ordered id
 * list after a move; we rewrite `sort_index` to match. Simpler + more robust
 * than swap-with-neighbour, and the line count per version is small.
 */
export async function reorderChanges(
  versionId: string,
  orderedIds: string[],
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const results = await Promise.all(
    orderedIds.map((id, index) =>
      supabase
        .from("app_version_changes")
        .update({ sort_index: index })
        .eq("id", id)
        .eq("version_id", versionId),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return { ok: false, message: failed.error.message };
  revalidateVersion(versionId);
  return { ok: true };
}

// ── Feedback link (the loop) ────────────────────────────────────────────

/** Tag a change line to a feedback report (link-only; no work_stage change). */
export async function linkFeedback(
  versionId: string,
  changeId: string,
  reportId: string,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("app_version_changes")
    .update({ feedback_report_id: reportId })
    .eq("id", changeId);
  if (error) return { ok: false, message: error.message };
  revalidateVersion(versionId);
  revalidatePath(`/feedback/${reportId}`);
  revalidatePath("/feedback");
  return { ok: true };
}

export async function unlinkFeedback(
  versionId: string,
  changeId: string,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  // Capture the report we're unlinking so its thread page can revalidate.
  const { data: existing } = await supabase
    .from("app_version_changes")
    .select("feedback_report_id")
    .eq("id", changeId)
    .maybeSingle();

  const { error } = await supabase
    .from("app_version_changes")
    .update({ feedback_report_id: null })
    .eq("id", changeId);
  if (error) return { ok: false, message: error.message };
  revalidateVersion(versionId);
  const reportId = existing?.feedback_report_id as string | null | undefined;
  if (reportId) {
    revalidatePath(`/feedback/${reportId}`);
    revalidatePath("/feedback");
  }
  return { ok: true };
}

/**
 * List the *open* feedback reports for the link picker, newest-priority first.
 * Reuses the existing `admin_feedback_queue` SECURITY DEFINER RPC, filtered to
 * the active work stages so anything already Fixed (or otherwise done) never
 * shows. An optional `query` narrows by free text - but with no query the full
 * open set is returned immediately, so the picker needs no search to be useful.
 *
 * Reports already tagged to any changelog line are filtered out so the same
 * report can't be shipped twice.
 */
export async function listOpenFeedback(
  query?: string,
): Promise<ActionResult<FeedbackSearchRow[]>> {
  await requireAdmin();
  const q = (query ?? "").trim();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_feedback_queue", {
    p_status_filter: null,
    p_severity_filter: null,
    p_kind_filter: null,
    p_tag_filter: null,
    p_search: q || null,
    p_limit: 50,
    p_offset: 0,
    p_work_stage_filter: FEEDBACK_ACTIVE_WORK_STAGES,
  });
  if (error) return { ok: false, message: error.message };

  // Hide reports already tagged to a changelog line (no double-shipping).
  const { data: linkedRows } = await supabase
    .from("app_version_changes")
    .select("feedback_report_id")
    .not("feedback_report_id", "is", null);
  const linked = new Set(
    ((linkedRows as Array<{ feedback_report_id: string | null }> | null) ?? [])
      .map((r) => r.feedback_report_id)
      .filter(Boolean) as string[],
  );

  const rows = (data as Array<Record<string, unknown>> | null) ?? [];
  return {
    ok: true,
    data: rows
      .map((r) => ({
        id: r.report_id as string,
        kind: (r.kind as string) ?? "general",
        status: (r.status as string) ?? "new",
        body_preview: (r.body_preview as string) ?? "",
      }))
      .filter((r) => !linked.has(r.id)),
  };
}

// ── Release → bulk-fix the linked reports ─────────────────────────────────

/** A linked, not-yet-resolved report surfaced in the release dialog. */
export type ReleaseReportRow = {
  reportId: string;
  changeId: string;
  changeKind: ChangeKind;
  changeSummary: string;
  reportKind: string;
  reportBody: string;
  /** False for anonymised reporters (account deleted) - still markable
   *  fixed, just no notification fires. */
  hasReporter: boolean;
};

/**
 * The reports that releasing `versionId` would close: every change line in the
 * version tagged to a feedback report that isn't already resolved. One row per
 * report (the first linked line wins) so a reporter is never listed twice. Drives
 * the release-confirmation dialog.
 */
export async function listReportsForRelease(
  versionId: string,
): Promise<ActionResult<ReleaseReportRow[]>> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: changeData, error } = await supabase
    .from("app_version_changes")
    .select("id, kind, summary, feedback_report_id")
    .eq("version_id", versionId)
    .not("feedback_report_id", "is", null)
    .order("sort_index", { ascending: true });
  if (error) return { ok: false, message: error.message };

  const changes =
    (changeData as Array<{
      id: string;
      kind: ChangeKind;
      summary: string;
      feedback_report_id: string;
    }> | null) ?? [];
  if (changes.length === 0) return { ok: true, data: [] };

  const reportIds = Array.from(new Set(changes.map((c) => c.feedback_report_id)));
  const { data: reportData } = await supabase
    .from("feedback_reports")
    .select("id, kind, status, body, user_id")
    .in("id", reportIds);
  const byId = new Map(
    ((reportData as Array<{
      id: string;
      kind: string;
      status: string;
      body: string;
      user_id: string | null;
    }> | null) ?? []).map((r) => [r.id, r]),
  );

  const out: ReleaseReportRow[] = [];
  const seen = new Set<string>();
  for (const c of changes) {
    const rep = byId.get(c.feedback_report_id);
    if (!rep) continue;
    if (rep.status === "resolved") continue; // already fixed - never re-notify
    if (seen.has(rep.id)) continue; // first linked line per report
    seen.add(rep.id);
    out.push({
      reportId: rep.id,
      changeId: c.id,
      changeKind: c.kind,
      changeSummary: c.summary,
      reportKind: rep.kind,
      reportBody: rep.body,
      hasReporter: rep.user_id != null,
    });
  }
  return { ok: true, data: out };
}

export type ReleaseItem = {
  reportId: string;
  note: string | null;
  /** Include this report in the release (mark it fixed + notify its reporter). */
  include: boolean;
};

/**
 * Release a version and, in one gesture, close every selected linked report.
 *
 * For each included report we call the existing `set_work_stage(_, 'fixed', note)`
 * RPC - which sets status=resolved, stores the note as the resolution card, and
 * fires `feedback_resolved` (the SQL skips the notification for anonymised
 * reporters). Then the version flips to released. Already-resolved reports were
 * filtered out by listReportsForRelease, so re-releasing won't double-notify.
 */
export async function releaseVersion(
  versionId: string,
  items: ReleaseItem[],
): Promise<ActionResult<{ fixed: number; failed: number }>> {
  const admin = await requireAdmin();
  // Releasing fires a batch of reporter notifications - gate it to super_admin.
  if (admin.role !== "super_admin") {
    return { ok: false, message: "Releasing a version requires super_admin." };
  }
  const supabase = await createClient();

  let fixed = 0;
  let failed = 0;
  for (const item of items) {
    if (!item.include) continue;
    const { error } = await supabase.rpc("set_work_stage", {
      p_report_id: item.reportId,
      p_stage: "fixed",
      p_resolution_note: item.note?.trim() || null,
    });
    if (error) {
      failed += 1;
      console.error("releaseVersion set_work_stage", error);
    } else {
      fixed += 1;
      revalidatePath(`/feedback/${item.reportId}`);
    }
  }

  // Flip the version to released (stamp released_at when not already set -
  // mirrors setReleased).
  const { data: existing } = await supabase
    .from("app_versions")
    .select("released_at")
    .eq("id", versionId)
    .maybeSingle();
  const update: Record<string, unknown> = {
    status: "released",
    last_edited_by_admin_id: admin.id,
  };
  if (!existing?.released_at) update.released_at = new Date().toISOString();

  const { error: relErr } = await supabase
    .from("app_versions")
    .update(update)
    .eq("id", versionId);
  if (relErr) return { ok: false, message: relErr.message };

  revalidateVersion(versionId);
  revalidatePath("/feedback");
  return { ok: true, data: { fixed, failed } };
}

/** Collapse a report body into a single-line change summary (≤140 chars). */
function summaryFromBody(body: string): string {
  const oneLine = body.trim().replace(/\s+/g, " ");
  if (!oneLine) return "Fixed a reported issue";
  return oneLine.length <= 140 ? oneLine : oneLine.slice(0, 137) + "…";
}

/**
 * Ship a feedback report into a version from the *feedback* side: append a new
 * change line to `versionId`, tagged to `reportId` and prefilled from the report
 * body (defaulting the kind to "fixed"). Closes the changelog↔feedback loop from
 * the thread page in a single click - the mirror of addChange + linkFeedback.
 */
export async function shipReportInVersion(
  versionId: string,
  reportId: string,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data: report } = await supabase
    .from("feedback_reports")
    .select("body")
    .eq("id", reportId)
    .maybeSingle();
  const summary = summaryFromBody((report?.body as string | null) ?? "");

  const { data: last } = await supabase
    .from("app_version_changes")
    .select("sort_index")
    .eq("version_id", versionId)
    .order("sort_index", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSort = (last?.sort_index ?? -1) + 1;

  const { error } = await supabase.from("app_version_changes").insert({
    version_id: versionId,
    kind: "fixed",
    summary,
    sort_index: nextSort,
    feedback_report_id: reportId,
    created_by_admin_id: admin.id,
  });
  if (error) return { ok: false, message: error.message };

  revalidateVersion(versionId);
  revalidatePath(`/feedback/${reportId}`);
  revalidatePath("/feedback");
  return { ok: true };
}
