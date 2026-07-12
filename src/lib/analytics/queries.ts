import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ONBOARDING_STEPS, ONBOARDING_STEP_LABEL } from "./config";

/**
 * Analytics read layer. Every function reads through a **service-role**
 * client (`createServiceClient()` from `lib/supabase/admin`) - `app_events`
 * and the domain tables have no admin SELECT policy, so the session client
 * would read zero rows.
 *
 * Aggregation lives in **version-controlled SQL views** (`analytics_*` /
 * `b2b_*`, granted to `service_role`) in the iOS migrations - not in code.
 * Each `b2b_*` view already excludes opted-out users and suppresses cells
 * below the cohort threshold IN SQL, so this layer is thin typed reads. The
 * functions here just `.select()` the views and hand back typed rows; the
 * one exception is `getEvents`, which reads raw `app_events` for the live
 * event feed.
 *
 * See `analytics-vocabulary.md` §3.4 / §8 for the view contract.
 */

export function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

// ── Row types (mirror the SQL view columns) ──────────────────────────────

export type OverviewRow = {
  total_users: number;
  users_7d: number;
  users_30d: number;
  total_rounds: number;
  rounds_7d: number;
  total_played_markers: number;
  total_events: number;
  events_today: number;
  active_7d: number;
  active_prior_7d: number;
  active_30d: number;
  opt_out_users: number;
};

export type DailyActivityRow = {
  day: string; // YYYY-MM-DD
  active_users: number;
  events: number;
  rounds: number;
  played_markers: number;
  signups: number;
};

export type FunnelRow = { step: string; label: string; users: number };

export type DiscoveryRow = { discovery_source: string; plays: number; users: number };

export type EventVolumeRow = {
  event_name: string;
  total: number;
  users: number;
  last_at: string | null;
};

export type ByVersionRow = {
  app_version: string;
  events: number;
  users: number;
  last_at: string | null;
};

export type DemographicRow = { dimension: string; band: string; n: number };

export type B2BVolumeRow = {
  club_id: string;
  club_name: string;
  plays: number;
  players: number;
};

export type B2BCatchmentRow = {
  county_id: string;
  county_name: string;
  players: number;
};

export type B2BIntentRow = {
  club_id: string;
  club_name: string;
  intenders: number;
};

export type B2BConversionRow = {
  intended: number;
  converted: number;
  users: number;
  rate: number; // 0..1
};

export type B2BVisitorProfileRow = { dimension: string; band: string; players: number };

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

// ── View reads ────────────────────────────────────────────────────────────

/** The single-row platform pulse. Null when the view can't be read. */
export async function getOverview(supabase: SupabaseClient): Promise<OverviewRow | null> {
  const { data, error } = await supabase.from("analytics_overview").select("*").single();
  if (error) {
    console.error("analytics.getOverview", error.message);
    return null;
  }
  return (data as OverviewRow) ?? null;
}

/** 90 days of gap-filled daily activity, oldest→newest (the view's order). */
export async function getDailyActivity(supabase: SupabaseClient): Promise<DailyActivityRow[]> {
  const { data, error } = await supabase
    .from("analytics_daily_activity")
    .select("*")
    .order("day", { ascending: true });
  if (error) {
    console.error("analytics.getDailyActivity", error.message);
    return [];
  }
  return (data as DailyActivityRow[]) ?? [];
}

/** The activation funnel, ordered + labelled per `config.ts` (started → the
 *  onboarding steps in wizard order → completed). Unknown steps fall through. */
export async function getOnboardingFunnel(supabase: SupabaseClient): Promise<FunnelRow[]> {
  const { data, error } = await supabase.from("analytics_onboarding_funnel").select("*");
  if (error) {
    console.error("analytics.getOnboardingFunnel", error.message);
    return [];
  }
  const rows = (data as { step: string; users: number }[] | null) ?? [];
  const byStep = new Map(rows.map((r) => [r.step, r.users]));
  const order = ["started", ...ONBOARDING_STEPS, "completed"];
  const labelFor = (step: string): string => {
    if (step === "started") return "Started";
    if (step === "completed") return "Completed";
    return ONBOARDING_STEP_LABEL[step] ?? step;
  };
  return order
    .filter((step) => byStep.has(step))
    .map((step) => ({ step, label: labelFor(step), users: byStep.get(step) ?? 0 }));
}

/** The core-loop activation funnel from domain tables (Phase 1.5) — signed up →
 *  created profile → marked → logged → (added friend / came back). The first
 *  four are a nested funnel; `friended` + `returned` are separate milestones. */
export type ActivationRow = { step: string; label: string; users: number; sort: number };
export async function getActivationFunnel(supabase: SupabaseClient): Promise<ActivationRow[]> {
  const { data, error } = await supabase.rpc("admin_activation_funnel");
  if (error) {
    console.error("analytics.getActivationFunnel", error.message);
    return [];
  }
  return ((data as ActivationRow[] | null) ?? []).slice().sort((a, b) => a.sort - b.sort);
}

/** Discovery-source attribution, descending by plays. Source is labelled by
 *  the caller via `DISCOVERY_SOURCE_LABEL`. */
export async function getDiscovery(supabase: SupabaseClient): Promise<DiscoveryRow[]> {
  const { data, error } = await supabase
    .from("analytics_discovery")
    .select("*")
    .order("plays", { ascending: false });
  if (error) {
    console.error("analytics.getDiscovery", error.message);
    return [];
  }
  return (data as DiscoveryRow[]) ?? [];
}

/** Event volume by name, descending by total. Labelled by the caller via
 *  `eventLabel()` / `eventGroup()`. */
export async function getEventVolume(supabase: SupabaseClient): Promise<EventVolumeRow[]> {
  const { data, error } = await supabase
    .from("analytics_event_volume")
    .select("*")
    .order("total", { ascending: false });
  if (error) {
    console.error("analytics.getEventVolume", error.message);
    return [];
  }
  return (data as EventVolumeRow[]) ?? [];
}

/** Events + distinct users by app version, descending by events. */
export async function getByVersion(supabase: SupabaseClient): Promise<ByVersionRow[]> {
  const { data, error } = await supabase
    .from("analytics_by_version")
    .select("*")
    .order("events", { ascending: false });
  if (error) {
    console.error("analytics.getByVersion", error.message);
    return [];
  }
  return (data as ByVersionRow[]) ?? [];
}

/** Internal demographic distribution (age / handicap / player-type bands). */
export async function getDemographics(supabase: SupabaseClient): Promise<DemographicRow[]> {
  const { data, error } = await supabase.from("analytics_demographics").select("*");
  if (error) {
    console.error("analytics.getDemographics", error.message);
    return [];
  }
  return (data as DemographicRow[]) ?? [];
}

// ── B2B preview (threshold + opt-out enforced in SQL) ─────────────────────

/** Volume by club: plays + distinct players, descending. Threshold-suppressed. */
export async function getB2BVolume(supabase: SupabaseClient): Promise<B2BVolumeRow[]> {
  const { data, error } = await supabase
    .from("b2b_volume_by_club")
    .select("*")
    .order("plays", { ascending: false });
  if (error) {
    console.error("analytics.getB2BVolume", error.message);
    return [];
  }
  return (data as B2BVolumeRow[]) ?? [];
}

/** Catchment: distinct players by home county, descending. Threshold-suppressed. */
export async function getB2BCatchment(supabase: SupabaseClient): Promise<B2BCatchmentRow[]> {
  const { data, error } = await supabase
    .from("b2b_catchment")
    .select("*")
    .order("players", { ascending: false });
  if (error) {
    console.error("analytics.getB2BCatchment", error.message);
    return [];
  }
  return (data as B2BCatchmentRow[]) ?? [];
}

// ── County shapes (for the catchment choropleth) ─────────────────────────

export type GeoPolygon =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };
export type CountyShape = { id: string; name: string; polygon: GeoPolygon };

/** Ceremonial-county GeoJSON for the catchment choropleth. Static editorial
 *  geometry (no privacy surface); shading values come from b2b_catchment. */
export async function getCountyShapes(supabase: SupabaseClient): Promise<CountyShape[]> {
  const { data, error } = await supabase
    .from("counties")
    .select("id, name, polygon")
    .not("polygon", "is", null);
  if (error) {
    console.error("analytics.getCountyShapes", error.message);
    return [];
  }
  return (data as CountyShape[]) ?? [];
}

/** Want-to-play intent by club, descending. Threshold-suppressed. Replaces the
 *  dropped bucket-list intent read. */
export async function getB2BIntent(supabase: SupabaseClient): Promise<B2BIntentRow[]> {
  const { data, error } = await supabase
    .from("b2b_intent_by_club")
    .select("*")
    .order("intenders", { ascending: false });
  if (error) {
    console.error("analytics.getB2BIntent", error.message);
    return [];
  }
  return (data as B2BIntentRow[]) ?? [];
}

/** Single-row want-to-play → played conversion. Null when unreadable. */
export async function getB2BConversion(supabase: SupabaseClient): Promise<B2BConversionRow | null> {
  const { data, error } = await supabase.from("b2b_conversion").select("*").single();
  if (error) {
    console.error("analytics.getB2BConversion", error.message);
    return null;
  }
  return (data as B2BConversionRow) ?? null;
}

/** Threshold-suppressed demographic visitor profile (age / handicap / player-type). */
export async function getB2BVisitorProfile(
  supabase: SupabaseClient,
): Promise<B2BVisitorProfileRow[]> {
  const { data, error } = await supabase.from("b2b_visitor_profile").select("*");
  if (error) {
    console.error("analytics.getB2BVisitorProfile", error.message);
    return [];
  }
  return (data as B2BVisitorProfileRow[]) ?? [];
}

// ── Raw event feed (still needs raw rows) ─────────────────────────────────

/** Recent raw events for the live feed, newest first. */
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
    .limit(opts.limit ?? 200);
  if (opts.sinceIso) q = q.gte("created_at", opts.sinceIso);
  if (opts.eventName) q = q.eq("event_name", opts.eventName);
  const { data, error } = await q;
  if (error) {
    console.error("analytics.getEvents", error.message);
    return [];
  }
  return (data as AppEventRow[]) ?? [];
}
