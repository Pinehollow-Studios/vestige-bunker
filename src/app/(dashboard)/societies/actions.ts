"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createDevClient } from "@/lib/supabase/server";
import type {
  SocietyCrestData,
  SocietyTemplateKind,
  SocietyTemplateStatus,
  SocietyTemplateTargetType,
} from "./types";

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; message: string };

// ---------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------

/** Insert a fresh `society_templates` row (draft) and open its editor. */
export async function createTemplate(name: string): Promise<ActionResult<string>> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, message: "Name is required." };

  const supabase = await createDevClient();
  const slug = await uniqueSlug(supabase, slugify(trimmed));

  const { data, error } = await supabase
    .from("society_templates")
    .insert({
      slug,
      name: trimmed,
      kind: "completion",
      target_type: "county",
      name_pattern: `{county} ${trimmed}`,
      status: "draft",
    })
    .select("id")
    .single();

  if (error) return { ok: false, message: error.message };
  revalidatePath("/societies");
  redirect(`/societies/${data.id}`);
}

/** Patch fields on a template. Empty strings coerce to null for the
 *  optional copy fields (PostgREST sends `''`, not `null`). */
export async function updateTemplate(
  templateId: string,
  patch: {
    name?: string;
    slug?: string;
    kind?: SocietyTemplateKind;
    target_type?: SocietyTemplateTargetType | null;
    fixed_list_id?: string | null;
    name_pattern?: string;
    blurb?: string | null;
    story_template?: string | null;
    crest?: SocietyCrestData;
    default_duration_days?: number | null;
    featured?: boolean;
    sort_order?: number;
  },
): Promise<ActionResult> {
  const supabase = await createDevClient();
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
  if (patch.kind !== undefined) update.kind = patch.kind;
  if (patch.target_type !== undefined) update.target_type = patch.target_type;
  if (patch.fixed_list_id !== undefined) update.fixed_list_id = patch.fixed_list_id;
  if (patch.name_pattern !== undefined) {
    const t = patch.name_pattern.trim();
    if (!t) return { ok: false, message: "Name pattern can't be empty." };
    update.name_pattern = t;
  }
  if (patch.blurb !== undefined) update.blurb = patch.blurb?.trim() || null;
  if (patch.story_template !== undefined) update.story_template = patch.story_template?.trim() || null;
  if (patch.crest !== undefined) update.crest = patch.crest;
  if (patch.default_duration_days !== undefined) update.default_duration_days = patch.default_duration_days;
  if (patch.featured !== undefined) update.featured = patch.featured;
  if (patch.sort_order !== undefined) update.sort_order = patch.sort_order;

  if (Object.keys(update).length === 0) return { ok: true };
  update.updated_at = new Date().toISOString();

  const { error } = await supabase.from("society_templates").update(update).eq("id", templateId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/societies");
  revalidatePath(`/societies/${templateId}`);
  return { ok: true };
}

export async function setTemplateStatus(
  templateId: string,
  status: SocietyTemplateStatus,
): Promise<ActionResult> {
  const supabase = await createDevClient();
  const { error } = await supabase
    .from("society_templates")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", templateId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/societies");
  revalidatePath(`/societies/${templateId}`);
  return { ok: true };
}

export async function deleteTemplate(templateId: string): Promise<ActionResult> {
  const supabase = await createDevClient();
  const { error } = await supabase.from("society_templates").delete().eq("id", templateId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/societies");
  redirect("/societies");
}

// ---------------------------------------------------------------------
// Per-county theming
// ---------------------------------------------------------------------

/** Upsert per-county theming (name override, story, crest). Keeps the
 *  county in `draft` — going live is the separate, checklist-gated
 *  {@link publishCounty}. */
export async function saveCountyTheme(
  templateId: string,
  countyId: string,
  patch: {
    name_override?: string | null;
    story?: string | null;
    crest?: SocietyCrestData | null;
  },
): Promise<ActionResult> {
  const supabase = await createDevClient();
  const row: Record<string, unknown> = {
    template_id: templateId,
    county_id: countyId,
    updated_at: new Date().toISOString(),
  };
  if (patch.name_override !== undefined) row.name_override = patch.name_override?.trim() || null;
  if (patch.story !== undefined) row.story = patch.story?.trim() || null;
  if (patch.crest !== undefined) row.crest = patch.crest;

  const { error } = await supabase
    .from("society_template_counties")
    .upsert(row, { onConflict: "template_id,county_id" });
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/societies/${templateId}`);
  revalidatePath(`/societies/${templateId}/counties/${countyId}`);
  return { ok: true };
}

/** Publish a county live — gated by the checklist (a story must exist).
 *  Mirrors the publish gate the workbench surfaces before enabling it. */
export async function publishCounty(
  templateId: string,
  countyId: string,
): Promise<ActionResult> {
  const supabase = await createDevClient();

  const { data: theme, error: readErr } = await supabase
    .from("society_template_counties")
    .select("story")
    .eq("template_id", templateId)
    .eq("county_id", countyId)
    .maybeSingle();
  if (readErr) return { ok: false, message: readErr.message };
  if (!theme || !theme.story || !String(theme.story).trim()) {
    return { ok: false, message: "Add a story line before publishing this county." };
  }

  const { error } = await supabase
    .from("society_template_counties")
    .update({ status: "live", published_at: new Date().toISOString() })
    .eq("template_id", templateId)
    .eq("county_id", countyId);
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/societies/${templateId}`);
  revalidatePath(`/societies/${templateId}/counties/${countyId}`);
  return { ok: true };
}

export async function unpublishCounty(
  templateId: string,
  countyId: string,
): Promise<ActionResult> {
  const supabase = await createDevClient();
  const { error } = await supabase
    .from("society_template_counties")
    .update({ status: "draft", published_at: null })
    .eq("template_id", templateId)
    .eq("county_id", countyId);
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/societies/${templateId}`);
  revalidatePath(`/societies/${templateId}/counties/${countyId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

async function uniqueSlug(
  supabase: Awaited<ReturnType<typeof createDevClient>>,
  base: string,
): Promise<string> {
  if (!base) return crypto.randomUUID().slice(0, 8);
  const { data } = await supabase
    .from("society_templates")
    .select("slug")
    .eq("slug", base)
    .maybeSingle();
  if (!data) return base;
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}
