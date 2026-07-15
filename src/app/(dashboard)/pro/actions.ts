"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createServiceClient } from "@/lib/supabase/admin";

export type ActionResult = { ok: true; message?: string } | { ok: false; message: string };

/**
 * Vestige Pro admin actions. Every write goes through an `is_admin()`-gated
 * RPC in `20260713100000_pro_entitlements.sql`; the service-role client is used
 * because `pro_config` / `pro_grants` have no authenticated policy, and
 * `requireAdmin()` is the gate on this side.
 *
 * The principle these serve (Vestige-ios `docs/pro-tier-backend.md`): **the
 * server is the source of truth for who is Pro** — never Apple, never the
 * client. Grants made here are one of the two inputs to that answer.
 */

async function client() {
  await requireAdmin();
  return createServiceClient();
}

/**
 * The founding-perk switch. `enabled` arms the dormant `users_founding_pro_grant`
 * trigger so **new** founding members automatically get their free window;
 * `months` is how long that window is (and what the launch batch below grants).
 *
 * Turning this on does NOT retroactively grant existing founders — that's
 * `grantBetaProToFounders()`, deliberately a separate, explicit act.
 */
export async function setFoundingPerk(
  enabled: boolean,
  months: number,
): Promise<ActionResult> {
  if (!Number.isInteger(months) || months < 1 || months > 60) {
    return { ok: false, message: "Free months must be a whole number between 1 and 60." };
  }

  let supabase;
  try {
    supabase = await client();
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Service-role not configured" };
  }

  const { error } = await supabase.rpc("admin_set_pro_config", {
    p_founding_pro_enabled: enabled,
    p_beta_free_months: months,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/pro");
  return { ok: true };
}

/**
 * The launch button — grants every existing founding member their free Pro
 * window, counted from **now** (not from their signup). Idempotent: anyone who
 * already holds a live `founding_beta` grant is skipped, so running it twice is
 * harmless.
 *
 * This starts real clocks for real people. The UI confirms first.
 */
export async function grantBetaProToFounders(): Promise<ActionResult> {
  let supabase;
  try {
    supabase = await client();
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Service-role not configured" };
  }

  const { data, error } = await supabase.rpc("admin_grant_beta_pro_to_founders", {
    p_months: null, // use pro_config.beta_free_months — one source of truth
  });
  if (error) return { ok: false, message: error.message };

  const granted = typeof data === "number" ? data : 0;
  revalidatePath("/pro");
  return {
    ok: true,
    message:
      granted === 0
        ? "No new grants — every founding member already had one."
        : `Granted free Pro to ${granted} founding member${granted === 1 ? "" : "s"}.`,
  };
}

/** Comp / promo / manual Pro for one person, by username. */
export async function grantProToUsername(
  username: string,
  kind: "comp" | "promo" | "manual",
  expiresAt: string | null,
  reason: string | null,
): Promise<ActionResult> {
  const handle = username.trim().replace(/^@/, "");
  if (!handle) return { ok: false, message: "Enter a username." };

  let supabase;
  try {
    supabase = await client();
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Service-role not configured" };
  }

  const { data: user, error: lookupError } = await supabase
    .from("users")
    .select("id, username")
    .ilike("username", handle)
    .maybeSingle();
  if (lookupError) return { ok: false, message: lookupError.message };
  if (!user) return { ok: false, message: `No user called @${handle}.` };

  const { error } = await supabase.rpc("admin_grant_pro", {
    p_user: user.id,
    p_kind: kind,
    p_expires_at: expiresAt || null, // null = lifetime
    p_reason: reason?.trim() || null,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/pro");
  return {
    ok: true,
    message: `@${user.username} now has Pro${expiresAt ? "" : " for life"}.`,
  };
}

/** Soft-revoke a grant (sets `revoked_at`; the row stays for the audit trail). */
export async function revokeProGrant(grantId: string): Promise<ActionResult> {
  let supabase;
  try {
    supabase = await client();
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Service-role not configured" };
  }

  const { error } = await supabase.rpc("admin_revoke_pro_grant", { p_grant_id: grantId });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/pro");
  return { ok: true, message: "Grant revoked." };
}
