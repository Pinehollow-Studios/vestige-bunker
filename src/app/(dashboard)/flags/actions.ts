"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createServiceClient } from "@/lib/supabase/admin";
import type { BroadcastAudienceKind, BroadcastTarget, FlagValueType } from "./types";

export type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; message: string };

/** Service-role client (is_admin() short-circuits for it), behind requireAdmin. */
async function adminClient() {
  await requireAdmin();
  return createServiceClient();
}

export type UpsertFlagInput = {
  key: string;
  description: string;
  value_type: FlagValueType;
  value: unknown; // the jsonb value delivered to in-scope users
  enabled: boolean;
  rollout_percentage: number;
  audience_kind: BroadcastAudienceKind;
  target: BroadcastTarget;
  min_app_version: string | null;
  max_app_version: string | null;
};

const KEY_RE = /^[a-z][a-z0-9_]*$/;

/** Create or update a flag. Server-side validation (in the RPC) is the real
 *  gate; this catches the obvious cases early with friendlier copy. */
export async function upsertFlag(input: UpsertFlagInput): Promise<ActionResult> {
  if (!KEY_RE.test(input.key)) {
    return { ok: false, message: "Key must be lower_snake_case, e.g. societies_enabled" };
  }
  if (input.rollout_percentage < 0 || input.rollout_percentage > 100) {
    return { ok: false, message: "Rollout must be between 0 and 100" };
  }
  if (input.value_type === "boolean" && typeof input.value !== "boolean") {
    return { ok: false, message: "On/off flags need a true or false value" };
  }
  if (input.value_type === "number" && typeof input.value !== "number") {
    return { ok: false, message: "Number flags need a numeric value" };
  }
  if (input.value_type === "string" && typeof input.value !== "string") {
    return { ok: false, message: "Text flags need a text value" };
  }

  let supabase;
  try {
    supabase = await adminClient();
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Service-role not configured" };
  }

  const { error } = await supabase.rpc("admin_upsert_feature_flag", {
    p_key: input.key,
    p_description: input.description,
    p_value_type: input.value_type,
    p_value: input.value,
    p_enabled: input.enabled,
    p_rollout_percentage: input.rollout_percentage,
    p_audience_kind: input.audience_kind,
    p_target: input.target,
    p_min_app_version: input.min_app_version?.trim() || null,
    p_max_app_version: input.max_app_version?.trim() || null,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/flags");
  return { ok: true };
}

/** The one-click master on/off. */
export async function setFlagEnabled(key: string, enabled: boolean): Promise<ActionResult> {
  let supabase;
  try {
    supabase = await adminClient();
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Service-role not configured" };
  }
  const { error } = await supabase.rpc("admin_set_feature_flag_enabled", {
    p_key: key,
    p_enabled: enabled,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/flags");
  return { ok: true };
}

export async function setFlagArchived(key: string, archived: boolean): Promise<ActionResult> {
  let supabase;
  try {
    supabase = await adminClient();
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Service-role not configured" };
  }
  const { error } = await supabase.rpc("admin_set_feature_flag_archived", {
    p_key: key,
    p_archived: archived,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/flags");
  return { ok: true };
}

export async function deleteFlag(key: string): Promise<ActionResult> {
  let supabase;
  try {
    supabase = await adminClient();
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Service-role not configured" };
  }
  const { error } = await supabase.rpc("admin_delete_feature_flag", { p_key: key });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/flags");
  return { ok: true };
}

/** Replace the hand-picked recipient set (individuals audience). */
export async function setFlagTargets(key: string, userIds: string[]): Promise<ActionResult> {
  let supabase;
  try {
    supabase = await adminClient();
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Service-role not configured" };
  }
  const { error } = await supabase.rpc("set_feature_flag_targets", {
    p_key: key,
    p_user_ids: userIds,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

/** Live reach — how many users match this flag right now. */
export async function fetchFlagReach(key: string): Promise<ActionResult<number>> {
  let supabase;
  try {
    supabase = await adminClient();
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Service-role not configured" };
  }
  const { data, error } = await supabase.rpc("admin_feature_flag_reach", { p_key: key });
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: (data as number) ?? 0 };
}
