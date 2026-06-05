"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type {
  BadgeCategory, BadgeEffect, BadgeShape, BadgeTheme, BadgeTier, Criteria,
} from "./types";

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; message: string };

/**
 * Create a fresh draft badge and redirect into its editor. Starts as a
 * manual-criteria draft so nothing auto-mints until the admin sets it up and
 * publishes.
 */
export async function createBadge(name: string): Promise<ActionResult<string>> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, message: "Name is required." };

  const supabase = await createClient();
  const slug = await uniqueSlug(supabase, slugify(trimmed));

  const { data, error } = await supabase
    .from("badge_definitions")
    .insert({
      slug,
      name: trimmed,
      glyph: "rosette",
      theme: "mint",
      tier: "bronze",
      shape: "rosette",
      effect: "none",
      category: "collection",
      criteria: { type: "manual" },
      is_published: false,
    })
    .select("id")
    .single();

  if (error) return { ok: false, message: error.message };
  revalidatePath("/badges");
  redirect(`/badges/${data.id}`);
}

export type BadgePatch = {
  name?: string;
  slug?: string;
  tagline?: string | null;
  description?: string | null;
  how_to_earn?: string | null;
  glyph?: string;
  theme?: BadgeTheme;
  tint_hex?: string | null;
  tier?: BadgeTier;
  shape?: BadgeShape;
  effect?: BadgeEffect;
  criteria?: Criteria;
  category?: BadgeCategory;
  series_key?: string | null;
  series_rank?: number | null;
  display_priority?: number;
  is_secret?: boolean;
};

export async function updateBadge(id: string, patch: BadgePatch): Promise<ActionResult> {
  const supabase = await createClient();
  const update: Record<string, unknown> = {};

  if (patch.name !== undefined) {
    const t = patch.name.trim();
    if (!t) return { ok: false, message: "Name can't be empty." };
    update.name = t;
  }
  if (patch.slug !== undefined) {
    const t = slugify(patch.slug);
    if (!t) return { ok: false, message: "Slug can't be empty." };
    update.slug = t;
  }
  if (patch.tagline !== undefined) update.tagline = patch.tagline?.trim() || null;
  if (patch.description !== undefined) update.description = patch.description?.trim() || null;
  if (patch.how_to_earn !== undefined) update.how_to_earn = patch.how_to_earn?.trim() || null;
  if (patch.glyph !== undefined) update.glyph = patch.glyph;
  if (patch.theme !== undefined) update.theme = patch.theme;
  if (patch.tint_hex !== undefined) update.tint_hex = normaliseHex(patch.tint_hex);
  if (patch.tier !== undefined) update.tier = patch.tier;
  if (patch.shape !== undefined) update.shape = patch.shape;
  if (patch.effect !== undefined) update.effect = patch.effect;
  if (patch.criteria !== undefined) update.criteria = patch.criteria;
  if (patch.category !== undefined) update.category = patch.category;
  if (patch.series_key !== undefined) update.series_key = patch.series_key?.trim() || null;
  if (patch.series_rank !== undefined) update.series_rank = patch.series_rank;
  if (patch.display_priority !== undefined) update.display_priority = patch.display_priority;
  if (patch.is_secret !== undefined) update.is_secret = patch.is_secret;

  if (Object.keys(update).length === 0) return { ok: true };

  const { error } = await supabase.from("badge_definitions").update(update).eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/badges");
  revalidatePath(`/badges/${id}`);
  return { ok: true };
}

export async function setBadgePublished(id: string, published: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("badge_definitions")
    .update({ is_published: published, is_archived: false })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/badges");
  revalidatePath(`/badges/${id}`);
  return { ok: true };
}

export async function setBadgeArchived(id: string, archived: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("badge_definitions")
    .update({ is_archived: archived })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/badges");
  revalidatePath(`/badges/${id}`);
  return { ok: true };
}

export async function deleteBadge(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("badge_definitions").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/badges");
  redirect("/badges");
}

/**
 * Award a published auto-criteria badge to everyone who already qualifies.
 * Wraps the `admin_backfill_badge_definition` RPC. Returns the grant count.
 */
export async function backfillBadge(id: string): Promise<ActionResult<number>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_backfill_badge_definition", {
    p_definition: id,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/badges/${id}`);
  return { ok: true, data: (data as number) ?? 0 };
}

/** Manually grant a badge to a user (for `manual` badges + one-offs). */
export async function grantBadgeToUser(
  definitionId: string,
  userId: string,
): Promise<ActionResult> {
  const trimmed = userId.trim();
  if (!isUuid(trimmed)) return { ok: false, message: "Enter a valid user UUID." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_grant_badge", {
    p_user: trimmed,
    p_definition: definitionId,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function revokeBadgeFromUser(
  definitionId: string,
  userId: string,
): Promise<ActionResult> {
  const trimmed = userId.trim();
  if (!isUuid(trimmed)) return { ok: false, message: "Enter a valid user UUID." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_revoke_badge", {
    p_user: trimmed,
    p_definition: definitionId,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

/**
 * Upload optional custom badge artwork to the `badge-art` bucket at
 * `badges/<id>/art.png` and patch `custom_image_key` with a cache-buster.
 */
export async function uploadBadgeArt(id: string, formData: FormData): Promise<ActionResult<string>> {
  const file = formData.get("art");
  if (!(file instanceof File)) return { ok: false, message: "No file provided." };
  if (file.size === 0) return { ok: false, message: "File is empty." };

  const supabase = await createClient();
  const path = `badges/${id}/art.png`;
  const bytes = await file.arrayBuffer();

  const { error: uploadErr } = await supabase.storage
    .from("badge-art")
    .upload(path, bytes, { contentType: file.type || "image/png", upsert: true });
  if (uploadErr) return { ok: false, message: `Upload failed: ${uploadErr.message}` };

  const key = `${path}?v=${crypto.randomUUID().slice(0, 8)}`;
  const { error: patchErr } = await supabase
    .from("badge_definitions")
    .update({ custom_image_key: key })
    .eq("id", id);
  if (patchErr) return { ok: false, message: `Save failed: ${patchErr.message}` };

  revalidatePath(`/badges/${id}`);
  return { ok: true, data: key };
}

export async function removeBadgeArt(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  await supabase.storage.from("badge-art").remove([`badges/${id}/art.png`]);
  const { error } = await supabase
    .from("badge_definitions")
    .update({ custom_image_key: null })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/badges/${id}`);
  return { ok: true };
}

// ── helpers ─────────────────────────────────────────────────────────

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);
}

async function uniqueSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  base: string,
): Promise<string> {
  if (!base) return crypto.randomUUID().slice(0, 8);
  const { data } = await supabase
    .from("badge_definitions")
    .select("slug")
    .eq("slug", base)
    .maybeSingle();
  if (!data) return base;
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

function normaliseHex(hex: string | null): string | null {
  if (!hex) return null;
  const clean = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return `#${clean.toUpperCase()}`;
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
