"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createDevClient } from "@/lib/supabase/server";
import { curatedCoverStorageKey } from "@/lib/storage";

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; message: string };

/**
 * Insert a fresh `curated_lists` row in the draft state and
 * redirect into its editor. The slug is derived from the
 * supplied name; admins can edit it from the editor.
 *
 * Slug rules: lowercase, hyphenated, alphanumeric only. If the
 * derivation collides with an existing slug, append a 6-char
 * suffix (UUID prefix) — admins can rename it later.
 */
export async function createCuratedList(name: string): Promise<ActionResult<string>> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, message: "Name is required." };

  const supabase = await createDevClient();
  const baseSlug = slugify(trimmed);
  const slug = await uniqueSlug(supabase, baseSlug);

  const { data, error } = await supabase
    .from("curated_lists")
    .insert({
      name: trimmed,
      slug,
      is_ordered: true, // Default to ordered (Top 100 shape); admin can flip to unordered.
      is_archived: false,
    })
    .select("id")
    .single();

  if (error) return { ok: false, message: error.message };
  revalidatePath("/curated");
  redirect(`/curated/${data.id}`);
}

/**
 * Patch fields on a curated list. Empty strings get coerced to
 * null for the optional fields (description, bio, region, tier)
 * because PostgREST sends empty strings as `''` not `null`.
 */
export async function updateCuratedList(
  listId: string,
  patch: {
    name?: string;
    slug?: string;
    description?: string | null;
    bio?: string | null;
    region?: string | null;
    tier?: "flagship" | "standard" | null;
    tags?: string[];
    display_priority?: number | null;
    is_ordered?: boolean;
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
  if (patch.description !== undefined) update.description = patch.description?.trim() || null;
  if (patch.bio !== undefined) update.bio = patch.bio?.trim() || null;
  if (patch.region !== undefined) update.region = patch.region?.trim() || null;
  if (patch.tier !== undefined) update.tier = patch.tier;
  if (patch.tags !== undefined) update.tags = patch.tags;
  if (patch.display_priority !== undefined) update.display_priority = patch.display_priority;
  if (patch.is_ordered !== undefined) update.is_ordered = patch.is_ordered;

  if (Object.keys(update).length === 0) return { ok: true };

  const { error } = await supabase.from("curated_lists").update(update).eq("id", listId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/curated");
  revalidatePath(`/curated/${listId}`);
  return { ok: true };
}

/**
 * Set `published_at` on a curated list. Pass `null` to revert to
 * draft, `new Date()` (server-side; we just send the iso string)
 * to publish immediately, or a future ISO string to schedule.
 * Clears `is_archived` when publishing — un-archiving a list and
 * publishing it are the same intent on the editor.
 */
export async function setPublishState(
  listId: string,
  publishedAt: string | null,
  unpublishedAt: string | null = null,
): Promise<ActionResult> {
  const supabase = await createDevClient();
  const { error } = await supabase
    .from("curated_lists")
    .update({
      published_at: publishedAt,
      unpublished_at: unpublishedAt,
      is_archived: false,
    })
    .eq("id", listId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/curated");
  revalidatePath(`/curated/${listId}`);
  return { ok: true };
}

export async function archiveList(listId: string): Promise<ActionResult> {
  const supabase = await createDevClient();
  const { error } = await supabase
    .from("curated_lists")
    .update({ is_archived: true })
    .eq("id", listId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/curated");
  revalidatePath(`/curated/${listId}`);
  return { ok: true };
}

export async function unarchiveList(listId: string): Promise<ActionResult> {
  const supabase = await createDevClient();
  const { error } = await supabase
    .from("curated_lists")
    .update({ is_archived: false })
    .eq("id", listId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/curated");
  revalidatePath(`/curated/${listId}`);
  return { ok: true };
}

export async function deleteCuratedList(listId: string): Promise<ActionResult> {
  const supabase = await createDevClient();
  const { error } = await supabase.from("curated_lists").delete().eq("id", listId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/curated");
  redirect("/curated");
}

/**
 * Add a course to a curated list at the next position. Idempotent
 * on the composite PK — re-adding silently no-ops via the
 * `on conflict do nothing` shape.
 */
export async function addCourseToList(
  listId: string,
  courseId: string,
): Promise<ActionResult> {
  const supabase = await createDevClient();
  // Find the next position by querying the current max.
  const { data: maxRow, error: maxErr } = await supabase
    .from("curated_list_courses")
    .select("position")
    .eq("curated_list_id", listId)
    .order("position", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (maxErr) return { ok: false, message: maxErr.message };
  const nextPosition = (maxRow?.position ?? 0) + 1;

  const { error } = await supabase.from("curated_list_courses").insert({
    curated_list_id: listId,
    course_id: courseId,
    position: nextPosition,
  });
  // Composite-PK conflict means the row already exists — treat
  // as success (idempotent add).
  if (error && !error.message.includes("duplicate key")) {
    return { ok: false, message: error.message };
  }
  revalidatePath(`/curated/${listId}`);
  return { ok: true };
}

export async function removeCourseFromList(
  listId: string,
  courseId: string,
): Promise<ActionResult> {
  const supabase = await createDevClient();
  const { error } = await supabase
    .from("curated_list_courses")
    .delete()
    .eq("curated_list_id", listId)
    .eq("course_id", courseId);
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/curated/${listId}`);
  return { ok: true };
}

/**
 * Rewrite the order of `listId`'s membership to match the
 * supplied array exactly — every position rewritten in a single
 * upsert. Mirrors the iOS `UserListRepository.reorderCourses`
 * semantics for user lists.
 */
export async function reorderCourses(
  listId: string,
  orderedCourseIds: string[],
): Promise<ActionResult> {
  const supabase = await createDevClient();
  const rows = orderedCourseIds.map((id, index) => ({
    curated_list_id: listId,
    course_id: id,
    position: index + 1,
  }));
  // Composite PK upsert — Postgres updates `position` on each row
  // without touching `created_at` / `editor_note`.
  const { error } = await supabase
    .from("curated_list_courses")
    .upsert(rows, {
      onConflict: "curated_list_id,course_id",
      ignoreDuplicates: false,
    });
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/curated/${listId}`);
  return { ok: true };
}

export async function setEditorNote(
  listId: string,
  courseId: string,
  note: string | null,
): Promise<ActionResult> {
  const supabase = await createDevClient();
  const trimmed = note?.trim() || null;
  const { error } = await supabase
    .from("curated_list_courses")
    .update({ editor_note: trimmed })
    .eq("curated_list_id", listId)
    .eq("course_id", courseId);
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/curated/${listId}`);
  return { ok: true };
}

/**
 * Cover-image upload. The browser POSTs the file via FormData;
 * we re-encode to JPEG via Storage's content-type header (no
 * server-side resize in v1 — admins should upload pre-cropped
 * 16:9 imagery, mirroring the iOS crop-on-upload pattern).
 *
 * Path: `curated/<list_id>/cover.jpg` (matches the admin-write
 * RLS policy on `storage.objects` from
 * `20260503120000_curated_lists_richer_publishing.sql`). After
 * upload, patches `curated_lists.cover_storage_key` with the
 * `?v=<UUID>` cache-buster suffix so iOS Nuke + browsers refetch.
 */
export async function uploadCuratedCover(
  listId: string,
  formData: FormData,
): Promise<ActionResult<string>> {
  const file = formData.get("cover");
  if (!(file instanceof File)) return { ok: false, message: "No file provided." };
  if (file.size === 0) return { ok: false, message: "File is empty." };

  const supabase = await createDevClient();
  const { path, key } = curatedCoverStorageKey(listId);
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadErr } = await supabase.storage
    .from("list-covers")
    .upload(path, arrayBuffer, {
      contentType: "image/jpeg",
      upsert: true,
    });
  if (uploadErr) return { ok: false, message: `Upload failed: ${uploadErr.message}` };

  const { error: patchErr } = await supabase
    .from("curated_lists")
    .update({ cover_storage_key: key })
    .eq("id", listId);
  if (patchErr) return { ok: false, message: `Save failed: ${patchErr.message}` };

  revalidatePath(`/curated/${listId}`);
  revalidatePath("/curated");
  return { ok: true, data: key };
}

export async function removeCuratedCover(listId: string): Promise<ActionResult> {
  const supabase = await createDevClient();
  const { path } = curatedCoverStorageKey(listId);
  // Storage 404 (object never existed) is benign — null the row
  // anyway so the UI catches up.
  await supabase.storage.from("list-covers").remove([path]);
  const { error } = await supabase
    .from("curated_lists")
    .update({ cover_storage_key: null })
    .eq("id", listId);
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/curated/${listId}`);
  revalidatePath("/curated");
  return { ok: true };
}

// ---------------------------------------------------------
// Helpers
// ---------------------------------------------------------

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
    .from("curated_lists")
    .select("slug")
    .eq("slug", base)
    .maybeSingle();
  if (!data) return base;
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}
