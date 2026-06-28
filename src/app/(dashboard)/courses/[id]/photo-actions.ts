"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createServiceClient } from "@/lib/supabase/admin";

export type ActionResult = { ok: true } | { ok: false; message: string };

/**
 * Per-course community-photo management (CLAUDE.md §5.2).
 *
 * Community course photos live in the `photos` table (kind='coursePhoto'),
 * uploaded by real users to the ACTIVE environment (prod by default) - distinct
 * from the editorial cover (`course-covers` bucket, authored on dev + synced).
 * `public.photos` has no admin SELECT/UPDATE policy, so every mutation here
 * goes through the service-role client for the active env (same pattern as
 * `photos/actions.ts`). `requireAdmin()` gates each call (defence in depth).
 *
 * `moderation_reviewer_user_id` is left untouched (NULL) for the same FK reason
 * as `photos/actions.ts`: the admin's auth uid isn't guaranteed to exist in the
 * project being moderated.
 */

async function service() {
  await requireAdmin();
  return createServiceClient();
}

/** Approve or reject a single course photo. */
export async function setCoursePhotoModeration(
  courseId: string,
  photoId: string,
  approve: boolean,
): Promise<ActionResult> {
  let supabase;
  try {
    supabase = await service();
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Service-role not configured" };
  }

  const { error } = await supabase
    .from("photos")
    .update({
      moderation_state: approve ? "approved" : "rejected",
      moderation_reviewed_at: new Date().toISOString(),
    })
    .eq("id", photoId)
    .eq("kind", "coursePhoto");
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/photos");
  return { ok: true };
}

/** Remove a course photo from the gallery (soft-delete - the read RPC filters
 *  `deleted_at is null`, so it vanishes from the app + admin immediately). */
export async function removeCoursePhoto(courseId: string, photoId: string): Promise<ActionResult> {
  let supabase;
  try {
    supabase = await service();
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Service-role not configured" };
  }

  const { error } = await supabase
    .from("photos")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", photoId)
    .eq("kind", "coursePhoto");
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/photos");
  return { ok: true };
}

/**
 * Persist a new gallery order. `orderedIds` is the desired top-to-bottom order;
 * each photo's `course_sort_index` is set to its position (0-based), so the
 * iOS reader (`course_photos_for_course`, ordered by sort_index asc nulls last)
 * and the admin manager render the same sequence. Position 0 is the lead - the
 * course's effective hero when there's no editorial cover.
 */
export async function reorderCoursePhotos(
  courseId: string,
  orderedIds: string[],
): Promise<ActionResult> {
  let supabase;
  try {
    supabase = await service();
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Service-role not configured" };
  }

  // Small N (a course's gallery) - individual updates keep it simple and avoid
  // an upsert that would trip the table's NOT NULL columns on its INSERT arm.
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("photos")
      .update({ course_sort_index: i })
      .eq("id", orderedIds[i])
      .eq("kind", "coursePhoto");
    if (error) {
      // Pre-migration env: the ordering column isn't there yet.
      if (error.message.includes("course_sort_index")) {
        return {
          ok: false,
          message:
            "Reordering needs the course-photo ordering migration (20260625120000) applied to this environment.",
        };
      }
      return { ok: false, message: error.message };
    }
  }

  revalidatePath(`/courses/${courseId}`);
  return { ok: true };
}
