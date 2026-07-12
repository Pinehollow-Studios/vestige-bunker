"use server";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createServiceClient } from "@/lib/supabase/admin";
import type { SegmentGroup } from "../segments/fields";

/**
 * Server actions for the deep-analytics explorers (retention · funnels ·
 * explore · paths). Each wraps one `admin_*` RPC from
 * `20260712210000_product_analytics.sql`, gated on the bunker admin session and
 * executed with the ACTIVE environment's service client so the explorers work
 * in both dev-view and prod-view (is_admin() short-circuits for service_role).
 */

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; message: string };

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<ActionResult<T>> {
  await requireAdmin();
  try {
    const supabase = await createServiceClient();
    const { data, error } = await supabase.rpc(fn, args);
    if (error) return { ok: false, message: error.message };
    return { ok: true, data: data as T };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

// ── Shapes ──────────────────────────────────────────────────────────────

export type EventNameRow = { event_name: string; total: number; users: number; first_seen: string; last_seen: string };
export type RetentionRow = { cohort_week: string; cohort_size: number; week_offset: number; active_users: number; retained_users: number };
export type FunnelStepRow = { step_index: number; event_name: string; users: number; median_minutes_from_prev: number | null };
export type SeriesRow = { bucket: string; dimension: string; events: number; users: number };
export type BreakdownRow = { dimension: string; events: number; users: number };
export type NextEventRow = { next_event: string; occurrences: number; sessions: number };
export type TopPathRow = { path: string; sessions: number };
export type SessionStatsRow = { sessions: number; users: number; avg_events: number | null; median_duration_minutes: number | null };
export type EngagementRow = { day: string; dau: number; wau: number; mau: number };

// ── Actions ─────────────────────────────────────────────────────────────

export async function loadEventNames(): Promise<ActionResult<EventNameRow[]>> {
  return rpc<EventNameRow[]>("admin_analytics_event_names", {});
}

export async function loadRetention(
  weeks: number,
  activity: "any" | "event" | "marker" | "round",
  segment: SegmentGroup | null,
): Promise<ActionResult<RetentionRow[]>> {
  return rpc<RetentionRow[]>("admin_retention_cohorts", {
    p_weeks: weeks,
    p_activity: activity,
    p_segment: segment,
  });
}

export async function runFunnel(
  steps: string[],
  fromISO: string,
  toISO: string,
  windowHours: number,
): Promise<ActionResult<FunnelStepRow[]>> {
  return rpc<FunnelStepRow[]>("admin_event_funnel", {
    p_steps: steps,
    p_from: fromISO,
    p_to: toISO,
    p_window_hours: windowHours,
  });
}

export async function loadEventSeries(
  event: string | null,
  fromISO: string,
  toISO: string,
  bucket: "day" | "week",
  breakdown: string | null,
): Promise<ActionResult<SeriesRow[]>> {
  return rpc<SeriesRow[]>("admin_event_series", {
    p_event: event,
    p_from: fromISO,
    p_to: toISO,
    p_bucket: bucket,
    p_breakdown: breakdown,
  });
}

export async function loadEventBreakdown(
  event: string | null,
  fromISO: string,
  toISO: string,
  breakdown: string,
): Promise<ActionResult<BreakdownRow[]>> {
  return rpc<BreakdownRow[]>("admin_event_breakdown", {
    p_event: event,
    p_from: fromISO,
    p_to: toISO,
    p_breakdown: breakdown,
  });
}

export async function loadNextEvents(
  event: string | null,
  fromISO: string,
  limit = 15,
): Promise<ActionResult<NextEventRow[]>> {
  return rpc<NextEventRow[]>("admin_next_events", { p_event: event, p_from: fromISO, p_limit: limit });
}

export async function loadTopPaths(fromISO: string, limit = 12): Promise<ActionResult<TopPathRow[]>> {
  return rpc<TopPathRow[]>("admin_top_paths", { p_from: fromISO, p_limit: limit });
}

export async function loadSessionStats(fromISO: string): Promise<ActionResult<SessionStatsRow | null>> {
  const r = await rpc<SessionStatsRow[]>("admin_session_stats", { p_from: fromISO });
  if (!r.ok) return r;
  return { ok: true, data: r.data?.[0] ?? null };
}

export async function loadEngagementSeries(days: number): Promise<ActionResult<EngagementRow[]>> {
  return rpc<EngagementRow[]>("admin_active_users_series", { p_days: days });
}

/** Saved segments for the retention cohort-comparison picker. */
export async function loadSegmentOptions(): Promise<ActionResult<{ id: string; name: string; definition: SegmentGroup }[]>> {
  await requireAdmin();
  try {
    const supabase = await createServiceClient();
    const { data, error } = await supabase.from("segments").select("id,name,definition").order("updated_at", { ascending: false });
    if (error) return { ok: false, message: error.message };
    return {
      ok: true,
      data: (data ?? []).map((s) => ({ id: s.id as string, name: s.name as string, definition: s.definition as SegmentGroup })),
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
