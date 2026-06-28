"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createServiceClient } from "@/lib/supabase/admin";

export type ActionResult = { ok: true } | { ok: false; message: string };

export type ModerationState = "pending" | "approved" | "rejected" | "flagged";

const ALLOWED: ModerationState[] = ["pending", "approved", "rejected", "flagged"];

/**
 * Set a photo's moderation state.
 *
 * Writes through the service-role client: `photos.moderation_state` (and the
 * sibling `moderation_*` columns) carry an admin-only column GRANT, so the
 * authenticated session can't touch them - service-role bypasses both RLS and
 * the column grant. Gated by `requireAdmin()` (defence in depth; the layout
 * already gates every /photos request).
 *
 * No user-facing side effects: the `handle_photo_moderation_state_change`
 * trigger that once notified uploaders was dropped on 2026-05-19 with the
 * verification teardown (`Vestige-ios` migration 20260519110000), so this is a
 * plain state flip.
 *
 * `moderation_reviewer_user_id` is deliberately left untouched (NULL): it FKs
 * `auth.users`, and the admin's auth uid isn't guaranteed to exist in the
 * project being moderated (dev vs prod are separate auth schemas), so setting
 * it risks an FK violation. Attribution, if needed later, belongs in a note.
 */
export async function setPhotoModeration(
  photoId: string,
  next: ModerationState,
  note?: string,
): Promise<ActionResult> {
  if (!ALLOWED.includes(next)) {
    return { ok: false, message: `Invalid moderation state: ${next}` };
  }

  await requireAdmin();

  let supabase;
  try {
    supabase = await createServiceClient();
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Service-role not configured",
    };
  }

  const patch: Record<string, unknown> = {
    moderation_state: next,
    moderation_reviewed_at: new Date().toISOString(),
  };
  const trimmed = note?.trim();
  if (trimmed) patch.moderation_note = trimmed;

  const { error } = await supabase.from("photos").update(patch).eq("id", photoId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/photos");
  return { ok: true };
}

/**
 * Bulk-set moderation state on many photos at once (grid bulk bar). One
 * `.in(...)` update through service-role. Same column-grant rationale as the
 * single setter; `moderation_reviewer_user_id` left NULL for the same FK reason.
 */
export async function setPhotoModerationBulk(
  photoIds: string[],
  next: ModerationState,
): Promise<ActionResult> {
  if (!ALLOWED.includes(next)) {
    return { ok: false, message: `Invalid moderation state: ${next}` };
  }
  await requireAdmin();
  if (photoIds.length === 0) return { ok: true };

  let supabase;
  try {
    supabase = await createServiceClient();
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Service-role not configured",
    };
  }

  const { error } = await supabase
    .from("photos")
    .update({ moderation_state: next, moderation_reviewed_at: new Date().toISOString() })
    .in("id", photoIds);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/photos");
  return { ok: true };
}
