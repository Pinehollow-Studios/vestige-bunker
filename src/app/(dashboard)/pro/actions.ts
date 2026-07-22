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

/**
 * Mint one-time promo codes (`admin_create_promo_codes`,
 * `20260722110000_pro_promo_codes.sql`). The server generates the words —
 * WORD-WORD-NN from the golf pools — and enforces uniqueness; a redeemed code
 * becomes a `pro_grants` row of kind `promo`. Returns the fresh codes so the
 * card can put them straight on the clipboard.
 */
export type CreateCodesResult =
  | { ok: true; codes: { id: string; code: string }[] }
  | { ok: false; message: string };

export async function createPromoCodes(
  kind: "trial" | "lifetime",
  durationMonths: number | null,
  count: number,
  label: string | null,
): Promise<CreateCodesResult> {
  if (kind === "trial" && (!Number.isInteger(durationMonths) || durationMonths! < 1 || durationMonths! > 60)) {
    return { ok: false, message: "Trial length must be a whole number of months, 1–60." };
  }
  if (!Number.isInteger(count) || count < 1 || count > 500) {
    return { ok: false, message: "Batch size must be a whole number between 1 and 500." };
  }

  let supabase;
  try {
    supabase = await client();
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Service-role not configured" };
  }

  const { data, error } = await supabase.rpc("admin_create_promo_codes", {
    p_kind: kind,
    p_duration_months: kind === "trial" ? durationMonths : null,
    p_count: count,
    p_label: label?.trim() || null,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/pro");
  return { ok: true, codes: (data ?? []) as { id: string; code: string }[] };
}

/** Void an unused code (`admin_revoke_promo_code`). Redeemed codes are history — they stay. */
export async function revokePromoCode(codeId: string): Promise<ActionResult> {
  let supabase;
  try {
    supabase = await client();
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Service-role not configured" };
  }

  const { error } = await supabase.rpc("admin_revoke_promo_code", { p_id: codeId });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/pro");
  return { ok: true, message: "Code voided." };
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
