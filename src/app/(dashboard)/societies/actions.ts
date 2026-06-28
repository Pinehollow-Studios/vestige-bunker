"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createDevClient } from "@/lib/supabase/server";
import type { ModeConfig, SocietyCrestData, WhoCanStart } from "./types";

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; message: string };

/**
 * Insert a new (disabled) mode and open its editor. New modes do nothing
 * in the app until a code mechanic exists for their `key` - they ship
 * disabled so they can be configured first.
 */
export async function createMode(name: string): Promise<ActionResult<string>> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, message: "Name is required." };

  const supabase = await createDevClient();
  const key = await uniqueKey(supabase, slugify(trimmed));

  const { data, error } = await supabase
    .from("society_modes")
    .insert({ key, name: trimmed, enabled: false, sort_order: 99, config: {} })
    .select("id")
    .single();

  if (error) return { ok: false, message: error.message };
  revalidatePath("/societies");
  redirect(`/societies/${data.id}`);
}

export async function updateMode(
  modeId: string,
  patch: {
    name?: string;
    tagline?: string | null;
    description?: string | null;
    glyph?: string;
    color?: string;
    crest?: SocietyCrestData;
    enabled?: boolean;
    sort_order?: number;
    who_can_start?: WhoCanStart;
    config?: ModeConfig;
  },
): Promise<ActionResult> {
  const supabase = await createDevClient();
  const update: Record<string, unknown> = {};

  if (patch.name !== undefined) {
    const t = patch.name.trim();
    if (!t) return { ok: false, message: "Name can't be empty." };
    update.name = t;
  }
  if (patch.tagline !== undefined) update.tagline = patch.tagline?.trim() || null;
  if (patch.description !== undefined) update.description = patch.description?.trim() || null;
  if (patch.crest !== undefined) {
    if (patch.crest.glyph) update.glyph = patch.crest.glyph;
    if (patch.crest.color) update.color = patch.crest.color;
  }
  if (patch.glyph !== undefined) update.glyph = patch.glyph;
  if (patch.color !== undefined) update.color = patch.color;
  if (patch.enabled !== undefined) update.enabled = patch.enabled;
  if (patch.sort_order !== undefined) update.sort_order = patch.sort_order;
  if (patch.who_can_start !== undefined) update.who_can_start = patch.who_can_start;
  if (patch.config !== undefined) update.config = patch.config;

  if (Object.keys(update).length === 0) return { ok: true };
  update.updated_at = new Date().toISOString();

  const { error } = await supabase.from("society_modes").update(update).eq("id", modeId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/societies");
  revalidatePath(`/societies/${modeId}`);
  return { ok: true };
}

export async function deleteMode(modeId: string): Promise<ActionResult> {
  const supabase = await createDevClient();
  const { error } = await supabase.from("society_modes").delete().eq("id", modeId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/societies");
  redirect("/societies");
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/(^_|_$)/g, "")
    .slice(0, 40);
}

async function uniqueKey(
  supabase: Awaited<ReturnType<typeof createDevClient>>,
  base: string,
): Promise<string> {
  if (!base) return `mode_${crypto.randomUUID().slice(0, 8)}`;
  const { data } = await supabase.from("society_modes").select("key").eq("key", base).maybeSingle();
  if (!data) return base;
  return `${base}_${crypto.randomUUID().slice(0, 4)}`;
}
