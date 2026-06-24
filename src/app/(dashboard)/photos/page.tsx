import Link from "next/link";
import { ImageIcon, MapPin } from "lucide-react";
import { SectionHeader } from "@/components/admin/SectionHeader";
import {
  activeStorageBaseUrl,
  tryCreateServiceClient,
} from "@/lib/supabase/admin";
import { photosRenderedURL } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { PhotoModerationActions } from "./PhotoModerationActions";

export const dynamic = "force-dynamic";

type PhotoModerationState = "pending" | "approved" | "rejected" | "flagged";
type PhotoKind = "roundPhoto" | "avatar" | "coursePhoto";

type Variants = {
  thumb_storage_key?: string;
  medium_storage_key?: string;
  large_storage_key?: string;
} | null;

type Row = {
  id: string;
  original_storage_key: string | null;
  variants: Variants;
  kind: PhotoKind;
  moderation_state: PhotoModerationState;
  uploader_user_id: string | null;
  exif_taken_at: string | null;
  exif_gps_lat: number | null;
  exif_gps_lng: number | null;
  round_id: string | null;
  course_id: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
};

const MODERATION_BUCKETS: PhotoModerationState[] = [
  "pending",
  "approved",
  "rejected",
  "flagged",
];

// Secondary filter — course photos are PUBLIC, shared-gallery content
// (CLAUDE.md §5.2 in Vestige-ios), so they warrant a higher review bar than
// round photos (which appear on a semi-private feed). The "Course photos"
// filter lets a moderator focus the queue on the community submissions.
const KIND_FILTERS = [
  { value: "all", label: "All" },
  { value: "coursePhoto", label: "Course photos" },
  { value: "roundPhoto", label: "Round photos" },
  { value: "avatar", label: "Avatars" },
] as const;
type KindFilter = (typeof KIND_FILTERS)[number]["value"];

type SearchParams = Promise<{ state?: string; kind?: string }>;

/**
 * Photo moderation surface — the NSFW / safety review queue for user-uploaded
 * photos. A photo stays `pending` until an admin approves it; the verdict gates
 * whether it surfaces on course pages and friend activity. Three kinds flow
 * through here: round photos, avatars, and `coursePhoto` — community
 * contributions to a course's public gallery (CLAUDE.md §5.2, pre-moderated:
 * only `approved` ones surface). The "Course photos" kind filter focuses the
 * queue on those public submissions, which warrant a higher review bar.
 *
 * Reads go through the service-role client: `public.photos` has only a
 * `photos_select_own` RLS policy (no admin SELECT), so the admin's session
 * would see ~zero rows. Service-role bypasses RLS and is gated by the layout's
 * `requireAdmin()`. Single moderation axis — the verification axis on
 * `photos.verification_state` was dropped 2026-05-19 (Vestige-ios migration
 * 20260519110000_drop_verification.sql).
 */
export default async function PhotosPage(props: { searchParams: SearchParams }) {
  const params = await props.searchParams;
  const active = MODERATION_BUCKETS.includes(params.state as PhotoModerationState)
    ? (params.state as PhotoModerationState)
    : "pending";
  const kind: KindFilter = KIND_FILTERS.some((k) => k.value === params.kind)
    ? (params.kind as KindFilter)
    : "all";

  const supabase = await tryCreateServiceClient();

  if (!supabase) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <SectionHeader
          eyebrow="Queues · Photo moderation"
          title="Photo moderation"
          description="Review user-uploaded round photos before they appear on course pages."
        />
        <ConfigNotice />
      </div>
    );
  }

  const baseUrl = await activeStorageBaseUrl();

  const [modCountsRes, listRes] = await Promise.all([
    Promise.all(
      MODERATION_BUCKETS.map(async (state) => {
        let q = supabase
          .from("photos")
          .select("id", { count: "exact", head: true })
          .eq("moderation_state", state);
        if (kind !== "all") q = q.eq("kind", kind);
        const { count } = await q;
        return [state, count ?? 0] as const;
      }),
    ),
    (() => {
      let q = supabase
        .from("photos")
        .select(
          "id, original_storage_key, variants, kind, moderation_state, uploader_user_id, exif_taken_at, exif_gps_lat, exif_gps_lng, round_id, course_id, width, height, created_at",
        )
        .eq("moderation_state", active);
      if (kind !== "all") q = q.eq("kind", kind);
      return q.order("created_at", { ascending: false }).limit(60);
    })(),
  ]);

  const modCounts = Object.fromEntries(modCountsRes) as Record<PhotoModerationState, number>;
  const rows: Row[] = (listRes.data as Row[] | null) ?? [];

  // Resolve uploader + course display names in one round-trip each — the tile
  // needs human names, not UUIDs. Same approach as courses/page.tsx.
  const uploaderIds = uniq(rows.map((r) => r.uploader_user_id));
  const courseIds = uniq(rows.map((r) => r.course_id));
  const [uploaderNames, courseNames] = await Promise.all([
    resolveUploaderNames(supabase, uploaderIds),
    resolveCourseNames(supabase, courseIds),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <SectionHeader
        eyebrow="Queues · Photo moderation"
        title="Photo moderation"
        description="Review user-uploaded round and course photos before they appear on course pages. Course photos are public, shared-gallery submissions — review them at a higher bar. Approve, reject, or flag each one."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {MODERATION_BUCKETS.map((state) => (
          <StatTile
            key={state}
            state={state}
            label={prettyMod(state)}
            value={modCounts[state]}
            active={state === active}
            kind={kind}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {KIND_FILTERS.map((k) => (
          <Link
            key={k.value}
            href={`/photos?state=${active}${k.value === "all" ? "" : `&kind=${k.value}`}`}
            className={cn(
              "rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
              k.value === kind
                ? "border-brand/50 bg-brand/10 text-brand"
                : "border-rule/70 text-ink-2 hover:border-brand/40 hover:text-ink",
            )}
          >
            {k.label}
          </Link>
        ))}
      </div>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-2">
              {prettyMod(active)} queue
            </h2>
            <span className="text-[11px] tabular-nums text-ink-3">{rows.length}</span>
          </div>
          {listRes.error && (
            <p className="text-xs text-alert">Failed to load: {listRes.error.message}</p>
          )}
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title={active === "pending" ? "Nothing to moderate" : `No ${prettyMod(active).toLowerCase()} photos`}
            subtitle={
              active === "pending"
                ? "No photos are awaiting review."
                : "Nothing in this bucket yet."
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((row) => (
              <PhotoTile
                key={row.id}
                row={row}
                baseUrl={baseUrl}
                uploaderName={row.uploader_user_id ? uploaderNames[row.uploader_user_id] : null}
                courseName={row.course_id ? courseNames[row.course_id] : null}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PhotoTile({
  row,
  baseUrl,
  uploaderName,
  courseName,
}: {
  row: Row;
  baseUrl: string;
  uploaderName: string | null;
  courseName: string | null;
}) {
  const thumb = photosRenderedURL(
    row.variants?.medium_storage_key ?? row.variants?.thumb_storage_key,
    baseUrl,
  );
  const full = photosRenderedURL(row.variants?.large_storage_key, baseUrl) ?? thumb;
  const geotagged = row.exif_gps_lat != null && row.exif_gps_lng != null;

  return (
    <figure className="flex flex-col overflow-hidden rounded-xl glass-panel">
      {full ? (
        <a
          href={full}
          target="_blank"
          rel="noreferrer"
          className="group/img relative block aspect-square bg-paper-sunken"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumb ?? full}
            alt={`${prettyKind(row.kind)} by ${uploaderName ?? "user"}`}
            className="size-full object-cover transition-opacity group-hover/img:opacity-90"
          />
          {geotagged && (
            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
              <MapPin className="size-2.5" aria-hidden /> Geotagged
            </span>
          )}
        </a>
      ) : (
        <div className="flex aspect-square items-center justify-center bg-paper-sunken/60 text-ink-3">
          <ImageIcon className="size-6" aria-hidden />
        </div>
      )}

      <figcaption className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs font-medium text-ink">
            {uploaderName ?? "Unknown user"}
          </span>
          <StateChip state={row.moderation_state} />
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          <KindChip kind={row.kind} />
          <span className="truncate text-[11px] text-ink-2">
            {courseName ?? (row.round_id ? "on a round" : "—")}
          </span>
        </div>
        <p className="text-[11px] tabular-nums text-ink-3">
          {row.width && row.height ? `${row.width}×${row.height} · ` : ""}
          {row.exif_taken_at ? `taken ${relativeTime(row.exif_taken_at)}` : "no exif"} · added{" "}
          {relativeTime(row.created_at)}
        </p>
        <div className="mt-auto pt-1">
          <PhotoModerationActions photoId={row.id} current={row.moderation_state} />
        </div>
      </figcaption>
    </figure>
  );
}

function StatTile({
  state,
  label,
  value,
  active,
  kind,
}: {
  state: PhotoModerationState;
  label: string;
  value: number;
  active: boolean;
  kind: KindFilter;
}) {
  const tone =
    state === "pending"
      ? "brand"
      : state === "rejected" || state === "flagged"
        ? "alert"
        : undefined;
  const numClass =
    tone === "brand" && value > 0
      ? "text-brand"
      : tone === "alert" && value > 0
        ? "text-alert"
        : "text-ink";
  return (
    <Link
      href={`/photos?state=${state}${kind === "all" ? "" : `&kind=${kind}`}`}
      className={cn(
        "rounded-xl glass-panel p-4 transition-colors hover:border-brand/40",
        active && "border-brand/50 ring-1 ring-brand/30",
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">{label}</p>
      <p className={"mt-2 font-hero text-3xl leading-none tabular-nums " + numClass}>
        {value.toLocaleString()}
      </p>
    </Link>
  );
}

function StateChip({ state }: { state: PhotoModerationState }) {
  const cls =
    state === "approved"
      ? "border-brand/40 text-brand"
      : state === "pending"
        ? "border-amber/40 text-amber"
        : state === "rejected" || state === "flagged"
          ? "border-alert/40 text-alert"
          : "border-rule/70 text-ink-3";
  return (
    <span
      className={
        "inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider " +
        cls
      }
    >
      {prettyMod(state)}
    </span>
  );
}

function KindChip({ kind }: { kind: PhotoKind }) {
  // Course photos are public, shared-gallery content — flag them in brand
  // accent so a moderator spots them at a glance; round/avatar are muted.
  const isCourse = kind === "coursePhoto";
  return (
    <span
      className={
        "inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider " +
        (isCourse ? "border-brand/40 text-brand" : "border-rule/70 text-ink-3")
      }
    >
      {prettyKind(kind)}
    </span>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl glass-panel px-4 py-12 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-brand/15 text-brand">
        <ImageIcon className="size-5" aria-hidden />
      </span>
      <p className="display-serif text-lg text-ink">{title}</p>
      <p className="text-sm text-ink-2">{subtitle}</p>
    </div>
  );
}

function ConfigNotice() {
  return (
    <div className="rounded-xl border border-amber/40 bg-amber/10 p-4 text-sm text-ink-2">
      Photo moderation needs the service-role key for the active environment.
      Set <code className="font-mono text-xs">SUPABASE_SERVICE_ROLE_KEY_DEV</code> /{" "}
      <code className="font-mono text-xs">SUPABASE_SERVICE_ROLE_KEY_PROD</code> (server-only) to
      read the queue — <code className="font-mono text-xs">public.photos</code> has no admin SELECT
      policy, so the session client can&apos;t see other users&apos; photos.
    </div>
  );
}

type SupabaseClient = NonNullable<Awaited<ReturnType<typeof tryCreateServiceClient>>>;

function uniq(values: Array<string | null>): string[] {
  return Array.from(new Set(values.filter((v): v is string => typeof v === "string")));
}

/** Resolve uploader ids → display name (display_name › username › "User"). */
async function resolveUploaderNames(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (ids.length === 0) return out;
  const { data } = await supabase
    .from("users")
    .select("id, display_name, username")
    .in("id", ids);
  for (const row of data ?? []) {
    out[row.id] = row.display_name || row.username || "User";
  }
  return out;
}

/** Resolve course ids → course name via one IN query. */
async function resolveCourseNames(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (ids.length === 0) return out;
  const { data } = await supabase.from("courses").select("id, name").in("id", ids);
  for (const row of data ?? []) out[row.id] = row.name;
  return out;
}

function prettyMod(state: PhotoModerationState): string {
  switch (state) {
    case "pending":
      return "Pending";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "flagged":
      return "Flagged";
  }
}

function prettyKind(kind: PhotoKind): string {
  switch (kind) {
    case "roundPhoto":
      return "Round photo";
    case "avatar":
      return "Avatar";
    case "coursePhoto":
      return "Course photo";
  }
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMins = Math.round(diffMs / 60_000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.round(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d`;
  return `${Math.round(diffDays / 30)}mo`;
}
