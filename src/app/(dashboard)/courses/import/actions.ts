"use server";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  fairwaysConfigured,
  latestFairwaysCommit,
  commitsAhead,
  pinnedSource,
  type FairwaysCommit,
} from "@/lib/courses-import/source";
import { parseCounties, parseCourses } from "@/lib/courses-import/parse";
import { buildPreview, type ImportPreview } from "@/lib/courses-import/preview";
import { importDataset } from "@/lib/courses-import/import";

const SCRIPT = "import-courses";

export interface LastImport {
  sha: string;
  startedAt: string;
  finishedAt: string | null;
  counties: number | null;
  courses: number | null;
  error: string | null;
}

export interface ImportStatus {
  configured: boolean;
  latestCommit: FairwaysCommit | null;
  lastImport: LastImport | null;
  commitsAhead: number | null;
  error?: string;
}

/** Status panel — readable by any admin (read-only, no writes). */
export async function getImportStatus(): Promise<ImportStatus> {
  await requireAdmin();
  if (!fairwaysConfigured()) {
    return {
      configured: false,
      latestCommit: null,
      lastImport: null,
      commitsAhead: null,
      error:
        "No GitHub token with access to Fairways-web. Set GITHUB_DISPATCH_TOKEN " +
        "(or GITHUB_CONTENT_TOKEN) with Contents:read on Pinehollow-Studios/Fairways-web.",
    };
  }

  try {
    const supabase = await createServiceClient();
    const [latestCommit, lastImportRow] = await Promise.all([
      latestFairwaysCommit(),
      supabase
        .from("dataset_imports")
        .select("source_commit_sha, started_at, finished_at, counties_upserted, courses_upserted, error_message")
        .eq("script", SCRIPT)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const row = lastImportRow.data as
      | {
          source_commit_sha: string;
          started_at: string;
          finished_at: string | null;
          counties_upserted: number | null;
          courses_upserted: number | null;
          error_message: string | null;
        }
      | null;

    const lastImport: LastImport | null = row
      ? {
          sha: row.source_commit_sha,
          startedAt: row.started_at,
          finishedAt: row.finished_at,
          counties: row.counties_upserted,
          courses: row.courses_upserted,
          error: row.error_message,
        }
      : null;

    const ahead =
      lastImport && lastImport.sha !== latestCommit.sha
        ? await commitsAhead(lastImport.sha)
        : lastImport
          ? 0
          : null;

    return { configured: true, latestCommit, lastImport, commitsAhead: ahead };
  } catch (err) {
    return {
      configured: true,
      latestCommit: null,
      lastImport: null,
      commitsAhead: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export type PreviewResult =
  | { ok: true; sha: string; preview: ImportPreview }
  | { ok: false; message: string };

/** Dry-run: fetch + transform + diff against live data. No writes. Any admin. */
export async function previewImport(sha: string): Promise<PreviewResult> {
  await requireAdmin();
  try {
    const source = pinnedSource(sha);
    const [counties, courses] = await Promise.all([parseCounties(source), parseCourses(source)]);
    const supabase = await createServiceClient();
    const preview = await buildPreview(supabase, counties, courses);
    return { ok: true, sha, preview };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

export type ApplyResult =
  | { ok: true; sha: string; counties: number; clubs: number; courses: number; indexRecomputed: boolean }
  | { ok: false; message: string };

/** Apply the import to the LIVE app. Any admin may run it — Tom + Jack are
 *  co-founders with equal access; the client's confirmation dialog is the
 *  safety gate, not a role wall. Writes prod course data with the service-role
 *  key; idempotent / upsert-only (nothing is ever deleted). */
export async function applyImport(sha: string, note?: string): Promise<ApplyResult> {
  await requireAdmin();

  let supabase;
  try {
    supabase = await createServiceClient();
    pinnedSource(sha); // validate the SHA shape early
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }

  // Audit row up front so a crash still leaves a trace (finished_at NULL).
  const { data: started, error: startErr } = await supabase
    .from("dataset_imports")
    .insert({ script: SCRIPT, source_commit_sha: sha, note: note?.trim() || "via dashboard" })
    .select("id")
    .single();
  if (startErr || !started) {
    return { ok: false, message: `Couldn't open audit row: ${startErr?.message ?? "no row"}` };
  }
  const auditId = (started as { id: string }).id;

  try {
    const source = pinnedSource(sha);
    const [counties, courses] = await Promise.all([parseCounties(source), parseCourses(source)]);
    const result = await importDataset(supabase, counties, courses);

    await supabase
      .from("dataset_imports")
      .update({
        finished_at: new Date().toISOString(),
        counties_upserted: result.countiesUpserted,
        clubs_upserted: result.clubsUpserted,
        courses_upserted: result.coursesUpserted,
      })
      .eq("id", auditId);

    // New courses land at seed prestige with a null index; refresh so they're
    // scored immediately rather than waiting for the nightly cron. Best-effort.
    const { error: recomputeErr } = await supabase.rpc("recompute_vestige_index");

    return {
      ok: true,
      sha,
      counties: result.countiesUpserted,
      clubs: result.clubsUpserted,
      courses: result.coursesUpserted,
      indexRecomputed: !recomputeErr,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("dataset_imports")
      .update({ error_message: message.slice(0, 4000) })
      .eq("id", auditId);
    return { ok: false, message };
  }
}
