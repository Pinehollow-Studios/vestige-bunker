/**
 * Storage URL helpers for the public Supabase buckets the iOS app
 * uploads into.
 *
 * Both buckets are configured public-read on iOS-side (avatars at
 * `20260425200005_storage_buckets.sql`, list-covers at
 * `20260502130000_list_covers_bucket.sql` + the owner-write
 * widening at `20260503100000_list_covers_owner_writes.sql`), so
 * the URLs returned here are unsigned and cacheable.
 *
 * Path layouts:
 *   - avatars:     `<supabase-url>/storage/v1/object/public/avatars/<userID>/avatar.jpg?v=<photoID>`
 *   - list-covers: `<supabase-url>/storage/v1/object/public/list-covers/<key>` where `<key>` may
 *                  itself carry a `?v=<UUID>` cache-buster suffix
 *                  (cover_storage_key on user_lists is the
 *                  full path + query)
 *
 * The base URL must match whichever Supabase project the page read its data
 * from. The dashboard defaults to prod (dev only via the hidden developer
 * switch), so the default base resolves to prod when configured — pinning it
 * to dev made every prod-data image 404. Server components that honour the dev
 * switch pass an explicit `baseUrl` from `activeStorageBaseUrl()`
 * (`lib/supabase/admin.ts`) for exact parity with the active env.
 *
 * Mirrors the iOS-side `AvatarURLProvider` /
 * `LiveListCoverURLProvider` so admins see exactly what users see.
 */

import { envConfig } from "./supabase/env";

/** Storage base URL. Defaults to the active-env default — prod when
 *  configured, dev otherwise (`envConfig` falls back) — matching the data
 *  client in `supabase/server.ts`. Pass `explicit` to target a specific env. */
function resolveBase(explicit?: string): string {
  return explicit ?? envConfig("prod").url;
}

export function avatarURL(
  userId: string | null | undefined,
  photoId: string | null | undefined,
  baseUrl?: string,
): string | null {
  const base = resolveBase(baseUrl);
  if (!userId || !photoId || !base) return null;
  // The iOS client downcases its `UUID.uuidString` to match
  // `auth.uid()::text` (lowercase per Postgres). Storage paths
  // were written with that convention, so read with it too.
  const folder = userId.toLowerCase();
  return `${base}/storage/v1/object/public/avatars/${folder}/avatar.jpg?v=${photoId}`;
}

export function listCoverURL(
  key: string | null | undefined,
  baseUrl?: string,
): string | null {
  const base = resolveBase(baseUrl);
  if (!key || !base) return null;
  // The storage key may include a `?v=<UUID>` cache-buster query
  // suffix — split + re-mount the parts so the URL is well-formed
  // (path doesn't contain `?`, query slot carries the buster).
  // Mirrors `LiveListCoverURLProvider.coverURL(forStorageKey:)`.
  const [path, query] = key.split("?", 2);
  const out = `${base}/storage/v1/object/public/list-covers/${path}`;
  return query ? `${out}?${query}` : out;
}

/**
 * Storage path layout for curated covers, distinct from user lists
 * (which write to `<owner_user_id>/<list_id>.jpg`). Curated covers
 * live under a `curated/` prefix so the admin-write RLS policy can
 * gate on `(storage.foldername(name))[1] = 'curated'` without
 * conflicting with the owner-folder check.
 *
 * Mirrors the iOS-side `LiveListCoverURLProvider` cache-busting
 * convention: the returned `cover_storage_key` includes a `?v=`
 * query suffix so `listCoverURL(...)` rebuilds a fresh URL after
 * each upload.
 */
export function curatedCoverStorageKey(
  curatedListId: string,
  cacheBuster: string = crypto.randomUUID(),
): { path: string; key: string } {
  const path = `curated/${curatedListId.toLowerCase()}/cover.jpg`;
  const key = `${path}?v=${cacheBuster}`;
  return { path, key };
}

/**
 * Course hero photo public URL builder. Mirrors `listCoverURL`'s
 * shape but reads from the `course-covers` bucket (created by
 * `20260504200200_course_covers_bucket.sql`). The
 * `hero_photo_storage_key` column carries the relative path with a
 * `?v=<UUID>` cache-buster suffix so a fresh upload invalidates
 * iOS's Nuke cache + browsers' HTTP caches.
 */
export function courseCoverURL(
  key: string | null | undefined,
  baseUrl?: string,
): string | null {
  const base = resolveBase(baseUrl);
  if (!key || !base) return null;
  const [path, query] = key.split("?", 2);
  const out = `${base}/storage/v1/object/public/course-covers/${path}`;
  return query ? `${out}?${query}` : out;
}

/**
 * Storage path layout for course hero photos. Each course has at
 * most one hero at the canonical path
 * `course-covers/<course_id>/cover.jpg`; uploads overwrite via
 * `upsert: true`, with a fresh `?v=<UUID>` cache-buster query
 * suffix so iOS Nuke + browsers refetch.
 *
 * The whole bucket is admin-only (no folder-prefix gate) per
 * `20260504200300_course_covers_admin_writes.sql`.
 */
export function courseCoverStorageKey(
  courseId: string,
  cacheBuster: string = crypto.randomUUID(),
): { path: string; key: string } {
  const path = `${courseId.toLowerCase()}/cover.jpg`;
  const key = `${path}?v=${cacheBuster}`;
  return { path, key };
}

/**
 * Announcement hero image public URL builder. Mirrors `courseCoverURL`'s
 * shape but reads from the public `announcement-media` bucket (created by
 * `20260607100000_announcements.sql`). The `image_storage_key` column carries
 * the relative path with a `?v=<UUID>` cache-buster suffix so a fresh upload
 * invalidates iOS's Nuke cache + browsers' HTTP caches.
 */
export function announcementMediaURL(
  key: string | null | undefined,
  baseUrl?: string,
): string | null {
  const base = resolveBase(baseUrl);
  if (!key || !base) return null;
  const [path, query] = key.split("?", 2);
  const out = `${base}/storage/v1/object/public/announcement-media/${path}`;
  return query ? `${out}?${query}` : out;
}

/**
 * Storage path layout for announcement hero images. Each announcement has at
 * most one hero at the canonical path
 * `announcement-media/<announcement_id>/hero.jpg`; uploads overwrite via
 * `upsert: true`, with a fresh `?v=<UUID>` cache-buster query suffix so iOS
 * Nuke + browsers refetch.
 *
 * The whole bucket is admin-write per `20260607100000_announcements.sql`.
 */
export function announcementMediaStorageKey(
  announcementId: string,
  cacheBuster: string = crypto.randomUUID(),
): { path: string; key: string } {
  const path = `${announcementId.toLowerCase()}/hero.jpg`;
  const key = `${path}?v=${cacheBuster}`;
  return { path, key };
}
