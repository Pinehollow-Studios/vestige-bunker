"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { announcementMediaStorageKey } from "@/lib/storage";
import type {
  AnnouncementActionKind,
  AnnouncementAudienceKind,
  AnnouncementKind,
  AnnouncementRecipient,
  AnnouncementStyle,
  AnnouncementTarget,
  RecipientState,
  UserPickRow,
} from "./types";

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; message: string };

/**
 * Create a fresh draft announcement and redirect into its editor. Starts as a
 * dismiss-only, everyone-audience draft (unpublished) so nothing surfaces in
 * the app until the admin authors it and publishes. Stamps the creating admin.
 */
export async function createAnnouncement(title: string): Promise<ActionResult<string>> {
  const trimmed = title.trim();
  if (!trimmed) return { ok: false, message: "Title is required." };

  const admin = await requireAdmin();
  const supabase = await createClient();
  const slug = await uniqueSlug(supabase, slugify(trimmed));

  const { data, error } = await supabase
    .from("announcements")
    .insert({
      slug,
      kind: "update",
      title: trimmed,
      body: "",
      highlights: [],
      action_kind: "dismiss",
      dismiss_label: "Got it",
      style: "modal_card",
      is_dismissible: true,
      priority: 0,
      audience_kind: "everyone",
      target: {},
      is_archived: false,
      created_by_admin_id: admin.id,
      last_edited_by_admin_id: admin.id,
    })
    .select("id")
    .single();

  if (error) return { ok: false, message: error.message };
  revalidatePath("/announcements");
  redirect(`/announcements/${data.id}`);
}

export type AnnouncementPatch = {
  slug?: string | null;
  kind?: AnnouncementKind;
  eyebrow?: string | null;
  title?: string;
  body?: string;
  highlights?: string[];
  action_kind?: AnnouncementActionKind;
  action_label?: string | null;
  action_value?: string | null;
  dismiss_label?: string;
  style?: AnnouncementStyle;
  is_dismissible?: boolean;
  priority?: number;
  audience_kind?: AnnouncementAudienceKind;
  min_app_version?: string | null;
  max_app_version?: string | null;
  target?: AnnouncementTarget;
};

/**
 * Patch fields on an announcement. Empty strings get coerced to null for the
 * optional text fields (PostgREST sends `''` not `null`). `updated_at` is set by
 * the `announcements_set_updated_at` trigger; we stamp `last_edited_by_admin_id`
 * here.
 */
export async function updateAnnouncement(
  id: string,
  patch: AnnouncementPatch,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const update: Record<string, unknown> = {};

  if (patch.slug !== undefined) update.slug = patch.slug ? slugify(patch.slug) : null;
  if (patch.kind !== undefined) update.kind = patch.kind;
  if (patch.eyebrow !== undefined) update.eyebrow = patch.eyebrow?.trim() || null;
  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (!t) return { ok: false, message: "Title can't be empty." };
    update.title = t;
  }
  if (patch.body !== undefined) update.body = patch.body;
  if (patch.highlights !== undefined) {
    update.highlights = patch.highlights.map((h) => h.trim()).filter(Boolean);
  }
  if (patch.action_kind !== undefined) update.action_kind = patch.action_kind;
  if (patch.action_label !== undefined) update.action_label = patch.action_label?.trim() || null;
  if (patch.action_value !== undefined) update.action_value = patch.action_value?.trim() || null;
  if (patch.dismiss_label !== undefined) {
    update.dismiss_label = patch.dismiss_label.trim() || "Got it";
  }
  if (patch.style !== undefined) update.style = patch.style;
  if (patch.is_dismissible !== undefined) update.is_dismissible = patch.is_dismissible;
  if (patch.priority !== undefined) update.priority = patch.priority;
  if (patch.audience_kind !== undefined) update.audience_kind = patch.audience_kind;
  if (patch.min_app_version !== undefined) {
    update.min_app_version = patch.min_app_version?.trim() || null;
  }
  if (patch.max_app_version !== undefined) {
    update.max_app_version = patch.max_app_version?.trim() || null;
  }
  if (patch.target !== undefined) update.target = patch.target;

  if (Object.keys(update).length === 0) return { ok: true };
  update.last_edited_by_admin_id = admin.id;

  const { error } = await supabase.from("announcements").update(update).eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/announcements");
  revalidatePath(`/announcements/${id}`);
  return { ok: true };
}

/**
 * Set `published_at` / `unpublished_at`. Pass `null` for `publishedAt` to revert
 * to draft, an ISO string in the past to publish now, or a future ISO string to
 * schedule. Clears `is_archived` — un-archiving and publishing are the same
 * intent on the editor (mirrors curated).
 */
export async function setPublishState(
  id: string,
  publishedAt: string | null,
  unpublishedAt: string | null = null,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("announcements")
    .update({
      published_at: publishedAt,
      unpublished_at: unpublishedAt,
      is_archived: false,
    })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/announcements");
  revalidatePath(`/announcements/${id}`);
  return { ok: true };
}

export async function setArchived(id: string, archived: boolean): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("announcements")
    .update({ is_archived: archived })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/announcements");
  revalidatePath(`/announcements/${id}`);
  return { ok: true };
}

/** Hard delete — super_admin only (mirrors feedback's deleteReport gate). */
export async function deleteAnnouncement(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (admin.role !== "super_admin") {
    return { ok: false, message: "Delete requires super_admin." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/announcements");
  redirect("/announcements");
}

/**
 * Replace the individual-target list for an announcement (audience_kind =
 * 'individuals'). Wipes the existing `announcement_targets` rows and inserts the
 * supplied user IDs — simplest correct semantics for a hand-picked list.
 */
export async function setTargets(
  id: string,
  userIds: string[],
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const unique = Array.from(new Set(userIds.filter((u) => isUuid(u))));

  const { error: delErr } = await supabase
    .from("announcement_targets")
    .delete()
    .eq("announcement_id", id);
  if (delErr) return { ok: false, message: delErr.message };

  if (unique.length > 0) {
    const rows = unique.map((userId) => ({ announcement_id: id, user_id: userId }));
    const { error: insErr } = await supabase.from("announcement_targets").insert(rows);
    if (insErr) return { ok: false, message: insErr.message };
  }

  revalidatePath(`/announcements/${id}`);
  return { ok: true };
}

/**
 * Search users by username / display name for the individuals picker. Admin RLS
 * permits reading `public.users`; citext + ilike makes the match
 * case-insensitive (same query shape as the /users directory).
 */
export async function searchUsers(query: string): Promise<ActionResult<UserPickRow[]>> {
  await requireAdmin();
  const q = query.trim();
  if (q.length < 2) return { ok: true, data: [] };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, username, display_name, avatar_photo_id")
    .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
    .order("username", { ascending: true })
    .limit(20);
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: (data ?? []) as UserPickRow[] };
}

/**
 * Hydrate the current individual targets to display names for the editor. Reads
 * the join table then resolves each user's minimal profile.
 */
export async function loadTargetUsers(id: string): Promise<ActionResult<UserPickRow[]>> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: targetRows, error: targetErr } = await supabase
    .from("announcement_targets")
    .select("user_id")
    .eq("announcement_id", id);
  if (targetErr) return { ok: false, message: targetErr.message };

  const ids = (targetRows ?? []).map((r) => r.user_id as string);
  if (ids.length === 0) return { ok: true, data: [] };

  const { data: users, error: usersErr } = await supabase
    .from("users")
    .select("id, username, display_name, avatar_photo_id")
    .in("id", ids);
  if (usersErr) return { ok: false, message: usersErr.message };
  return { ok: true, data: (users ?? []) as UserPickRow[] };
}

/**
 * The who-saw-it list, paginated + state-filtered, via
 * `admin_announcement_recipients`. State is one of all / acted / dismissed /
 * seen / not_seen. Drives the editor's recipients tab.
 */
export async function loadRecipients(
  id: string,
  state: RecipientState | "all",
  offset: number,
  limit: number,
): Promise<ActionResult<AnnouncementRecipient[]>> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_announcement_recipients", {
    p_id: id,
    p_state: state,
    p_limit: limit,
    p_offset: Math.max(0, offset),
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: (data as AnnouncementRecipient[] | null) ?? [] };
}

/**
 * Hero-image upload. The browser POSTs the file via FormData; we upsert it to
 * the public `announcement-media` bucket at `<id>/hero.jpg` and patch
 * `image_storage_key` with a `?v=<UUID>` cache-buster (mirrors the curated
 * cover-upload pattern). No server-side resize in v1 — admins upload
 * pre-sized imagery.
 */
export async function uploadHero(
  id: string,
  formData: FormData,
): Promise<ActionResult<string>> {
  await requireAdmin();
  const file = formData.get("hero");
  if (!(file instanceof File)) return { ok: false, message: "No file provided." };
  if (file.size === 0) return { ok: false, message: "File is empty." };

  const supabase = await createClient();
  const { path, key } = announcementMediaStorageKey(id);
  const bytes = await file.arrayBuffer();

  const { error: uploadErr } = await supabase.storage
    .from("announcement-media")
    .upload(path, bytes, { contentType: file.type || "image/jpeg", upsert: true });
  if (uploadErr) return { ok: false, message: `Upload failed: ${uploadErr.message}` };

  const { error: patchErr } = await supabase
    .from("announcements")
    .update({ image_storage_key: key })
    .eq("id", id);
  if (patchErr) return { ok: false, message: `Save failed: ${patchErr.message}` };

  revalidatePath(`/announcements/${id}`);
  revalidatePath("/announcements");
  return { ok: true, data: key };
}

export async function removeHero(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { path } = announcementMediaStorageKey(id);
  // Storage 404 (object never existed) is benign — null the column anyway.
  await supabase.storage.from("announcement-media").remove([path]);
  const { error } = await supabase
    .from("announcements")
    .update({ image_storage_key: null })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/announcements/${id}`);
  revalidatePath("/announcements");
  return { ok: true };
}

// ── Helpers ─────────────────────────────────────────────────────────

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);
}

async function uniqueSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  base: string,
): Promise<string> {
  if (!base) return crypto.randomUUID().slice(0, 8);
  const { data } = await supabase
    .from("announcements")
    .select("slug")
    .eq("slug", base)
    .maybeSingle();
  if (!data) return base;
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
