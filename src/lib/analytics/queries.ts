import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MIN_COHORT_N,
  ONBOARDING_STEPS,
  ONBOARDING_STEP_LABEL,
} from "./config";

/**
 * Analytics read layer. Every function reads through a **service-role**
 * client (`createServiceClient()` from `lib/supabase/admin`) — `app_events`
 * and the domain tables (`played_markers`, `bucket_list_items`,
 * `logged_rounds`, `users`) have no admin SELECT policy, so the session
 * client would read zero rows.
 *
 * Aggregation happens **in code** here (read rows → reduce). That's right for
 * the early-stage data volume and keeps everything in the admin repo (no
 * migrations). The scaling path (and the eventual club-facing export) is to
 * move these into `b2b_*` SQL views / `SECURITY DEFINER` RPCs in the iOS
 * migrations — see `analytics-vocabulary.md` §3.4 / §8. Reads are bounded by
 * `ROW_CAP`; past that, the in-code rollups undercount and must move server-side.
 */

const ROW_CAP = 20000;

export type AppEventRow = {
  id: string;
  user_id: string | null;
  event_name: string;
  properties: Record<string, unknown> | null;
  session_id: string | null;
  app_version: string | null;
  device_model: string | null;
  client_timestamp: string | null;
  created_at: string;
};

export function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function prop(row: AppEventRow, key: string): string | undefined {
  const v = row.properties?.[key];
  return typeof v === "string" ? v : undefined;
}

function dayKey(iso: string): string {
  return iso.slice(0, 10); // YYYY-MM-DD (UTC) — good enough for daily buckets
}

// ── Raw event reads ──────────────────────────────────────────────────────

/** Recent events for the window, newest first. One read powers the rollups
 *  below; pass a tight `sinceIso` to stay under `ROW_CAP`. */
export async function getEvents(
  supabase: SupabaseClient,
  opts: { sinceIso?: string; eventName?: string; limit?: number } = {},
): Promise<AppEventRow[]> {
  let q = supabase
    .from("app_events")
    .select(
      "id, user_id, event_name, properties, session_id, app_version, device_model, client_timestamp, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(Math.min(opts.limit ?? ROW_CAP, ROW_CAP));
  if (opts.sinceIso) q = q.gte("created_at", opts.sinceIso);
  if (opts.eventName) q = q.eq("event_name", opts.eventName);
  const { data, error } = await q;
  if (error) {
    console.error("analytics.getEvents", error.message);
    return [];
  }
  return (data as AppEventRow[]) ?? [];
}

// ── Pure rollups over a set of events ────────────────────────────────────

export type NamedCount = { key: string; label: string; count: number };

/** Event volume by `event_name`, descending. */
export function rollupVolume(rows: AppEventRow[]): NamedCount[] {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.event_name, (m.get(r.event_name) ?? 0) + 1);
  return [...m.entries()]
    .map(([key, count]) => ({ key, label: key, count }))
    .sort((a, b) => b.count - a.count);
}

/** Distinct active users per day for the trailing `days` window (gaps filled). */
export function rollupDAU(rows: AppEventRow[], days: number): { day: string; count: number }[] {
  const byDay = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!r.user_id) continue;
    const d = dayKey(r.created_at);
    if (!byDay.has(d)) byDay.set(d, new Set());
    byDay.get(d)!.add(r.user_id);
  }
  const out: { day: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = dayKey(isoDaysAgo(i));
    out.push({ day: d, count: byDay.get(d)?.size ?? 0 });
  }
  return out;
}

/** Activation funnel: distinct users reaching each stage of onboarding. */
export function rollupOnboardingFunnel(rows: AppEventRow[]): NamedCount[] {
  const usersAt = (pred: (r: AppEventRow) => boolean) => {
    const s = new Set<string>();
    for (const r of rows) if (r.user_id && pred(r)) s.add(r.user_id);
    return s.size;
  };
  const stages: NamedCount[] = [
    { key: "started", label: "Started", count: usersAt((r) => r.event_name === "onboarding_started") },
  ];
  for (const step of ONBOARDING_STEPS) {
    stages.push({
      key: step,
      label: ONBOARDING_STEP_LABEL[step] ?? step,
      count: usersAt(
        (r) => r.event_name === "onboarding_step_completed" && prop(r, "step") === step,
      ),
    });
  }
  stages.push({
    key: "completed",
    label: "Completed",
    count: usersAt((r) => r.event_name === "onboarding_completed"),
  });
  return stages;
}

/** Discovery-source attribution across the consideration/play events. */
export function rollupDiscovery(rows: AppEventRow[]): NamedCount[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const src = prop(r, "discovery_source");
    if (!src) continue;
    m.set(src, (m.get(src) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([key, count]) => ({ key, label: key, count }))
    .sort((a, b) => b.count - a.count);
}

export function distinctUsers(rows: AppEventRow[]): number {
  const s = new Set<string>();
  for (const r of rows) if (r.user_id) s.add(r.user_id);
  return s.size;
}

/** Distinct active users within the trailing `days` window (for the pulse). */
export function activeUsersInWindow(rows: AppEventRow[], days: number): number {
  const since = isoDaysAgo(days);
  const s = new Set<string>();
  for (const r of rows) if (r.user_id && r.created_at >= since) s.add(r.user_id);
  return s.size;
}

/** Distinct active users in the *previous* window [2·days, days) — the delta base. */
export function activeUsersPriorWindow(rows: AppEventRow[], days: number): number {
  const start = isoDaysAgo(days * 2);
  const end = isoDaysAgo(days);
  const s = new Set<string>();
  for (const r of rows) if (r.user_id && r.created_at >= start && r.created_at < end) s.add(r.user_id);
  return s.size;
}

/** Events by app version — the health/adoption read. */
export function rollupByVersion(rows: AppEventRow[]): NamedCount[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const v = r.app_version ?? "unknown";
    m.set(v, (m.get(v) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([key, count]) => ({ key, label: key, count }))
    .sort((a, b) => b.count - a.count);
}

/** New signups per day for the trailing window (gaps filled) — the growth lens. */
export async function getSignupSeries(
  supabase: SupabaseClient,
  days: number,
): Promise<{ day: string; count: number }[]> {
  const { data, error } = await supabase
    .from("users")
    .select("created_at")
    .gte("created_at", isoDaysAgo(days))
    .limit(ROW_CAP);
  if (error) console.error("analytics.getSignupSeries", error.message);
  const byDay = new Map<string, number>();
  for (const u of (data as { created_at: string }[] | null) ?? []) {
    byDay.set(dayKey(u.created_at), (byDay.get(dayKey(u.created_at)) ?? 0) + 1);
  }
  const out: { day: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = dayKey(isoDaysAgo(i));
    out.push({ day: d, count: byDay.get(d) ?? 0 });
  }
  return out;
}

export function distinctSessions(rows: AppEventRow[]): number {
  const s = new Set<string>();
  for (const r of rows) if (r.session_id) s.add(r.session_id);
  return s.size;
}

// ── Platform stats (counts) ──────────────────────────────────────────────

export type PlatformStats = {
  users: number;
  usersWeek: number;
  rounds: number;
  roundsWeek: number;
  playedMarkers: number;
  bucketItems: number;
  events: number;
  eventsToday: number;
};

type CountResponse = PromiseLike<{ count: number | null; error: { message: string } | null }>;
const HEAD = { count: "exact" as const, head: true };

async function runCount(q: CountResponse, label: string): Promise<number> {
  const { count, error } = await q;
  if (error) {
    console.error(`analytics.count(${label})`, error.message);
    return 0;
  }
  return count ?? 0;
}

export async function getPlatformStats(supabase: SupabaseClient): Promise<PlatformStats> {
  const week = isoDaysAgo(7);
  const today = isoDaysAgo(1);
  const [
    users,
    usersWeek,
    rounds,
    roundsWeek,
    playedMarkers,
    bucketItems,
    events,
    eventsToday,
  ] = await Promise.all([
    runCount(supabase.from("users").select("*", HEAD), "users"),
    runCount(supabase.from("users").select("*", HEAD).gte("created_at", week), "usersWeek"),
    runCount(supabase.from("logged_rounds").select("*", HEAD), "rounds"),
    runCount(supabase.from("logged_rounds").select("*", HEAD).gte("created_at", week), "roundsWeek"),
    runCount(supabase.from("played_markers").select("*", HEAD), "playedMarkers"),
    runCount(supabase.from("bucket_list_items").select("*", HEAD), "bucketItems"),
    runCount(supabase.from("app_events").select("*", HEAD), "events"),
    runCount(supabase.from("app_events").select("*", HEAD).gte("created_at", today), "eventsToday"),
  ]);
  return { users, usersWeek, rounds, roundsWeek, playedMarkers, bucketItems, events, eventsToday };
}

// ── B2B preview (domain tables, threshold + opt-out enforced) ────────────

/** Set of user ids that opted out of analytics — excluded from B2B aggregates
 *  *before* aggregation (excluded, not redacted; `analytics-vocabulary.md` §6.4). */
async function optedOutUsers(supabase: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("analytics_opt_out", true)
    .limit(ROW_CAP);
  if (error) {
    console.error("analytics.optedOutUsers", error.message);
    return new Set();
  }
  return new Set((data as { id: string }[] | null)?.map((u) => u.id) ?? []);
}

export type B2BRow = { key: string; label: string; plays: number; users: number };

/** Volume by club: plays + distinct players per club, suppressing any club
 *  below the cohort threshold (k-anonymity). */
export async function getB2BVolumeByClub(supabase: SupabaseClient): Promise<{ rows: B2BRow[]; suppressed: number }> {
  const [markersRes, coursesRes, clubsRes, optedOut] = await Promise.all([
    supabase.from("played_markers").select("user_id, course_id").limit(ROW_CAP),
    supabase.from("courses").select("id, club_id").limit(ROW_CAP),
    supabase.from("clubs").select("id, name").limit(ROW_CAP),
    optedOutUsers(supabase),
  ]);
  const courseClub = new Map<string, string>();
  for (const c of (coursesRes.data as { id: string; club_id: string }[] | null) ?? []) {
    courseClub.set(c.id, c.club_id);
  }
  const clubName = new Map<string, string>();
  for (const c of (clubsRes.data as { id: string; name: string }[] | null) ?? []) {
    clubName.set(c.id, c.name);
  }
  const agg = new Map<string, { plays: number; users: Set<string> }>();
  for (const m of (markersRes.data as { user_id: string; course_id: string }[] | null) ?? []) {
    if (!m.user_id || optedOut.has(m.user_id)) continue;
    const club = courseClub.get(m.course_id);
    if (!club) continue;
    if (!agg.has(club)) agg.set(club, { plays: 0, users: new Set() });
    const a = agg.get(club)!;
    a.plays += 1;
    a.users.add(m.user_id);
  }
  let suppressed = 0;
  const rows: B2BRow[] = [];
  for (const [club, a] of agg.entries()) {
    if (a.users.size < MIN_COHORT_N) {
      suppressed += 1;
      continue;
    }
    rows.push({ key: club, label: clubName.get(club) ?? "Unknown club", plays: a.plays, users: a.users.size });
  }
  rows.sort((a, b) => b.plays - a.plays);
  return { rows, suppressed };
}

/** Catchment: distinct players grouped by their home county, threshold-gated. */
export async function getB2BCatchment(supabase: SupabaseClient): Promise<{ rows: B2BRow[]; suppressed: number }> {
  const [markersRes, usersRes, countiesRes, optedOut] = await Promise.all([
    supabase.from("played_markers").select("user_id").limit(ROW_CAP),
    supabase.from("users").select("id, home_county_id").limit(ROW_CAP),
    supabase.from("counties").select("id, name").limit(ROW_CAP),
    optedOutUsers(supabase),
  ]);
  const userCounty = new Map<string, string | null>();
  for (const u of (usersRes.data as { id: string; home_county_id: string | null }[] | null) ?? []) {
    userCounty.set(u.id, u.home_county_id);
  }
  const countyName = new Map<string, string>();
  for (const c of (countiesRes.data as { id: string; name: string }[] | null) ?? []) {
    countyName.set(c.id, c.name);
  }
  const players = new Set<string>();
  for (const m of (markersRes.data as { user_id: string }[] | null) ?? []) {
    if (m.user_id && !optedOut.has(m.user_id)) players.add(m.user_id);
  }
  const byCounty = new Map<string, Set<string>>();
  for (const uid of players) {
    const county = userCounty.get(uid);
    if (!county) continue;
    if (!byCounty.has(county)) byCounty.set(county, new Set());
    byCounty.get(county)!.add(uid);
  }
  let suppressed = 0;
  const rows: B2BRow[] = [];
  for (const [county, set] of byCounty.entries()) {
    if (set.size < MIN_COHORT_N) {
      suppressed += 1;
      continue;
    }
    rows.push({ key: county, label: countyName.get(county) ?? "Unknown county", plays: set.size, users: set.size });
  }
  rows.sort((a, b) => b.users - a.users);
  return { rows, suppressed };
}

export type ConversionStat = { bucketed: number; converted: number; rate: number; users: number };

/** Bucket→played conversion: of all bucket-list items, how many became a
 *  played marker for the same (user, course). */
export async function getB2BConversion(supabase: SupabaseClient): Promise<ConversionStat> {
  const [bucketRes, markersRes, optedOut] = await Promise.all([
    supabase.from("bucket_list_items").select("user_id, course_id").limit(ROW_CAP),
    supabase.from("played_markers").select("user_id, course_id").limit(ROW_CAP),
    optedOutUsers(supabase),
  ]);
  const played = new Set<string>();
  for (const m of (markersRes.data as { user_id: string; course_id: string }[] | null) ?? []) {
    if (m.user_id) played.add(`${m.user_id}:${m.course_id}`);
  }
  let bucketed = 0;
  let converted = 0;
  const users = new Set<string>();
  for (const b of (bucketRes.data as { user_id: string; course_id: string }[] | null) ?? []) {
    if (!b.user_id || optedOut.has(b.user_id)) continue;
    bucketed += 1;
    users.add(b.user_id);
    if (played.has(`${b.user_id}:${b.course_id}`)) converted += 1;
  }
  return {
    bucketed,
    converted,
    rate: bucketed > 0 ? converted / bucketed : 0,
    users: users.size,
  };
}
