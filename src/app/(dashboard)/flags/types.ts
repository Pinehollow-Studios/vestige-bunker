/**
 * Shared types + vocabulary for the feature-flags admin surface.
 *
 * Mirrors the server `feature_flags` table + the `admin_feature_flags_overview`
 * / `admin_upsert_feature_flag` / … RPCs
 * (`Vestige-ios/supabase/migrations/20260712100000_feature_flags.sql`) and the
 * iOS `FeatureFlags` reader. Targeting reuses the Broadcasts/Announcements
 * `target` model verbatim, so the shared {@link AudiencePicker} drives it.
 */

import type {
  BroadcastAudienceKind,
  BroadcastTarget,
} from "@/app/(dashboard)/notifications/types";

export type { BroadcastAudienceKind, BroadcastTarget };

export type FlagValueType = "boolean" | "string" | "number" | "json";

export const VALUE_TYPES: FlagValueType[] = ["boolean", "string", "number", "json"];

export const VALUE_TYPE_LABELS: Record<FlagValueType, string> = {
  boolean: "On / off switch",
  string: "Text value",
  number: "Number value",
  json: "JSON value",
};

/** One flag as returned by `admin_feature_flags_overview()`. `value` is the
 *  jsonb value delivered to in-scope users (bool / number / string / object). */
export type FlagRow = {
  key: string;
  description: string;
  value_type: FlagValueType;
  value: unknown;
  enabled: boolean;
  rollout_percentage: number;
  audience_kind: BroadcastAudienceKind;
  target: BroadcastTarget;
  min_app_version: string | null;
  max_app_version: string | null;
  archived: boolean;
  target_user_count: number;
  updated_at: string;
  created_at: string;
};

/** Human one-liner for a flag's delivered value. */
export function valueSummary(row: Pick<FlagRow, "value_type" | "value">): string {
  switch (row.value_type) {
    case "boolean":
      return row.value === true ? "true" : "false";
    case "number":
      return typeof row.value === "number" ? String(row.value) : "—";
    case "string":
      return typeof row.value === "string" ? `“${row.value}”` : "—";
    case "json":
      return JSON.stringify(row.value ?? null);
  }
}

/** Human one-liner for who a flag reaches. */
export function audienceSummary(
  row: Pick<
    FlagRow,
    "audience_kind" | "min_app_version" | "max_app_version" | "target_user_count" | "rollout_percentage"
  >,
): string {
  let base: string;
  switch (row.audience_kind) {
    case "everyone":
      base = "Everyone";
      break;
    case "filtered":
      base = "Filtered cohort";
      break;
    case "individuals":
      base = `${row.target_user_count} hand-picked`;
      break;
  }
  if (row.rollout_percentage < 100) base += ` · ${row.rollout_percentage}% rollout`;
  const bounds = versionBoundsLabel(row.min_app_version, row.max_app_version);
  return bounds ? `${base} · ${bounds}` : base;
}

export function versionBoundsLabel(min: string | null, max: string | null): string | null {
  if (min && max) return min === max ? `v${min}` : `v${min}–${max}`;
  if (min) return `v${min}+`;
  if (max) return `≤v${max}`;
  return null;
}

/** The default delivered value for a freshly-created flag of each type. */
export function defaultValueFor(type: FlagValueType): unknown {
  switch (type) {
    case "boolean":
      return true;
    case "number":
      return 0;
    case "string":
      return "";
    case "json":
      return {};
  }
}
