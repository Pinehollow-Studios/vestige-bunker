"use server";

import { revalidatePath } from "next/cache";
import { createDevClient } from "@/lib/supabase/server";
import { courseCoverStorageKey } from "@/lib/storage";
import type { CourseLayout, CourseTier } from "./types";

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; message: string };

/**
 * Patch fields on a course. Empty strings get coerced to null for
 * the optional text fields (description, style) because PostgREST
 * sends `''` not `null`. `style` is normalised to Title Case before
 * write so the autocomplete combobox doesn't drift between
 * "Heathland" and "heathland".
 *
 * Audit: every successful patch stamps `last_edited_by_admin_id =
 * auth.uid()` and `last_edited_at = now()` so the index page can
 * render "Edited by Jack 2d ago".
 *
 * **Bridge** (Option β): the schema column is still named `type`
 * pre-M6; the patch writes `type` until the rename migration lands.
 * UI dropdowns surface this as `layout`, but the DB write keeps the
 * legacy name. Once M6 applies, swap `type` → `layout` here.
 */
export async function updateCourse(
  courseId: string,
  patch: {
    description?: string | null;
    par?: number | null;
    yards?: number | null;
    style?: string | null;
    established?: number | null;
    layout?: CourseLayout;
    tier?: CourseTier;
    hole_count?: number;
  },
): Promise<ActionResult> {
  const supabase = await createDevClient();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return { ok: false, message: "Not signed in." };
  }

  const update: Record<string, unknown> = {};
  if (patch.description !== undefined) {
    update.description = patch.description?.trim() || null;
  }
  if (patch.par !== undefined) {
    update.par = patch.par;
  }
  if (patch.yards !== undefined) {
    update.yards = patch.yards;
  }
  if (patch.style !== undefined) {
    update.style = normaliseStyle(patch.style);
  }
  if (patch.established !== undefined) {
    update.established = patch.established;
  }
  if (patch.layout !== undefined) {
    // Bridge: column is still `type` pre-M6.
    update.type = patch.layout;
  }
  if (patch.tier !== undefined) {
    update.tier = patch.tier;
  }
  if (patch.hole_count !== undefined) {
    update.hole_count = patch.hole_count;
  }

  if (Object.keys(update).length === 0) {
    return { ok: true };
  }

  update.last_edited_by_admin_id = user.id;
  update.last_edited_at = new Date().toISOString();

  const { error } = await supabase.from("courses").update(update).eq("id", courseId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/courses");
  revalidatePath(`/courses/${courseId}`);
  return { ok: true };
}

/**
 * Cover-image upload. The browser POSTs the file via FormData;
 * the Storage object is uploaded with content-type `image/jpeg`
 * (the cropper outputs JPEG). After upload, patches
 * `courses.hero_photo_storage_key` with a `?v=<UUID>` cache-
 * buster suffix so iOS Nuke + browsers refetch.
 *
 * Path: `<course_id>/cover.jpg` (matches the admin-write RLS on
 * `course-covers` from `20260504200300_course_covers_admin_writes.sql`).
 */
export async function uploadCourseCover(
  courseId: string,
  formData: FormData,
): Promise<ActionResult<string>> {
  const file = formData.get("cover");
  if (!(file instanceof File)) return { ok: false, message: "No file provided." };
  if (file.size === 0) return { ok: false, message: "File is empty." };

  const supabase = await createDevClient();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return { ok: false, message: "Not signed in." };
  }

  const { path, key } = courseCoverStorageKey(courseId);
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadErr } = await supabase.storage
    .from("course-covers")
    .upload(path, arrayBuffer, {
      contentType: "image/jpeg",
      upsert: true,
    });
  if (uploadErr) return { ok: false, message: `Upload failed: ${uploadErr.message}` };

  const { error: patchErr } = await supabase
    .from("courses")
    .update({
      hero_photo_storage_key: key,
      last_edited_by_admin_id: user.id,
      last_edited_at: new Date().toISOString(),
    })
    .eq("id", courseId);
  if (patchErr) return { ok: false, message: `Save failed: ${patchErr.message}` };

  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/courses");
  return { ok: true, data: key };
}

export async function removeCourseCover(courseId: string): Promise<ActionResult> {
  const supabase = await createDevClient();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return { ok: false, message: "Not signed in." };
  }

  const { path } = courseCoverStorageKey(courseId);
  // Storage 404 (object never existed) is benign — null the row
  // anyway so the UI catches up. Mirrors `removeCuratedCover`.
  await supabase.storage.from("course-covers").remove([path]);
  const { error } = await supabase
    .from("courses")
    .update({
      hero_photo_storage_key: null,
      last_edited_by_admin_id: user.id,
      last_edited_at: new Date().toISOString(),
    })
    .eq("id", courseId);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/courses");
  return { ok: true };
}

// ---------------------------------------------------------
// Helpers
// ---------------------------------------------------------

/**
 * Title Case normalisation for free-text style values. Matches the
 * autocomplete pattern: admins type "heathland" or "Heathland" or
 * "HEATHLAND" interchangeably; the canonical stored form is
 * "Heathland" so the distinct-values list doesn't drift.
 *
 * Multi-word styles ("Pitch & Putt") get every word capitalised; the
 * `&` and connectives stay as typed. We don't try to be clever about
 * articles ("of the") — editorial vocabulary doesn't have any.
 */
function normaliseStyle(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  return trimmed
    .split(/\s+/)
    .map((word) => {
      if (!word) return word;
      // Preserve all-caps single chars like "&".
      if (word.length === 1) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}
