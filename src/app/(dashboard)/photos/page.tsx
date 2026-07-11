import { pageShell } from "@/components/admin/PageShell";
import Link from "next/link";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { activeStorageBaseUrl, tryCreateServiceClient } from "@/lib/supabase/admin";
import { photosRenderedURL } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { PhotoModerationGrid, type GridPhoto, type PhotoKind } from "./PhotoModerationGrid";

export const dynamic = "force-dynamic";

type PhotoModerationState = "pending" | "approved" | "rejected" | "flagged";

type Variants = {
  thumb_storage_key?: string;
  medium_storage_key?: string;
  large_storage_key?: string;
} | null;

type Row = {
  id: string;
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

const MODERATION_BUCKETS: PhotoModerationState[] = ["pending", "approved", "rejected", "flagged"];
const KIND_FILTERS = [
  { value: "all", label: "All" },
  { value: "coursePhoto", label: "Course photos" },
  { value: "roundPhoto", label: "Round photos" },
  { value: "avatar", label: "Avatars" },
] as const;
type KindFilter = (typeof KIND_FILTERS)[number]["value"];

const FETCH_CAP = 120;
const PHOTO_COLS =
  "id, variants, kind, moderation_state, uploader_user_id, exif_taken_at, exif_gps_lat, exif_gps_lng, round_id, course_id, width, height, created_at";

type SearchParams = Promise<{ state?: string; kind?: string }>;

/**
 * Photo moderation - the safety review queue for user-uploaded photos (round
 * photos, avatars, and public `coursePhoto` gallery contributions, CLAUDE.md
 * §5.2). A photo stays `pending` until approved; only approved ones surface in
 * the app. Reads + writes go through service-role (`public.photos` has no admin
 * SELECT). The grid handles selection / bulk / keyboard / optimism.
 */
export default async function PhotosPage(props: { searchParams: SearchParams }) {
  const params = await props.searchParams;
  const active: PhotoModerationState = MODERATION_BUCKETS.includes(params.state as PhotoModerationState)
    ? (params.state as PhotoModerationState)
    : "pending";
  const kind: KindFilter = KIND_FILTERS.some((k) => k.value === params.kind)
    ? (params.kind as KindFilter)
    : "all";

  const supabase = await tryCreateServiceClient();
  if (!supabase) {
    return (
      <div className={pageShell("wide")}>
        <SectionHeader eyebrow="Queues · moderation" title="Photos" />
        <ConfigNotice />
      </div>
    );
  }

  const baseUrl = await activeStorageBaseUrl();

  // Bucket counts (scoped to the kind filter) for the state tiles.
  const modCountsRes = await Promise.all(
    MODERATION_BUCKETS.map(async (state) => {
      let q = supabase.from("photos").select("id", { count: "exact", head: true }).eq("moderation_state", state);
      if (kind !== "all") q = q.eq("kind", kind);
      const { count } = await q;
      return [state, count ?? 0] as const;
    }),
  );
  const modCounts = Object.fromEntries(modCountsRes) as Record<PhotoModerationState, number>;

  // The active bucket's newest rows.
  let listQuery = supabase
    .from("photos")
    .select(PHOTO_COLS)
    .eq("moderation_state", active)
    .order("created_at", { ascending: false })
    .limit(FETCH_CAP);
  if (kind !== "all") listQuery = listQuery.eq("kind", kind);
  const listRes = await listQuery;

  // `coursePhoto` enum may not exist on this env yet (prod pre-migration) → an
  // enum filter error is treated as an empty bucket, not a page failure.
  const err = listRes.error?.message ?? null;
  const unknownEnum = err?.includes("invalid input value for enum") ?? false;
  const rows = (listRes.data as Row[] | null) ?? [];

  const uploaderIds = uniq(rows.map((r) => r.uploader_user_id));
  const courseIds = uniq(rows.map((r) => r.course_id));
  const [uploaderNames, courseNames] = await Promise.all([
    resolveUploaderNames(supabase, uploaderIds),
    resolveCourseNames(supabase, courseIds),
  ]);

  const photos: GridPhoto[] = rows.map((r) => {
    const thumbUrl = photosRenderedURL(r.variants?.medium_storage_key ?? r.variants?.thumb_storage_key, baseUrl);
    const fullUrl = photosRenderedURL(r.variants?.large_storage_key, baseUrl) ?? thumbUrl;
    const context =
      (r.course_id ? courseNames[r.course_id] : null) ??
      (r.round_id ? "on a round" : r.kind === "avatar" ? "Profile avatar" : null);
    return {
      id: r.id,
      kind: r.kind,
      state: r.moderation_state,
      uploaderName: r.uploader_user_id ? (uploaderNames[r.uploader_user_id] ?? null) : null,
      contextLabel: context,
      isCourse: r.kind === "coursePhoto",
      thumbUrl,
      fullUrl,
      geotagged: r.exif_gps_lat != null && r.exif_gps_lng != null,
      dims: r.width && r.height ? `${r.width}×${r.height}` : null,
      takenAt: r.exif_taken_at,
      createdAt: r.created_at,
    };
  });

  return (
    <div className={pageShell("wide")}>
      <SectionHeader eyebrow="Queues · moderation" title="Photos" />

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

      {err && !unknownEnum && <p className="text-xs text-alert">Failed to load: {err}</p>}

      <PhotoModerationGrid photos={photos} activeState={active} />
    </div>
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
  const numClass =
    state === "pending" && value > 0
      ? "text-brand"
      : (state === "rejected" || state === "flagged") && value > 0
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
      <p className={"mt-2 font-display text-3xl font-semibold leading-none tabular-nums " + numClass}>
        {value.toLocaleString()}
      </p>
    </Link>
  );
}

function ConfigNotice() {
  return (
    <div className="rounded-xl border border-amber/40 bg-amber/10 p-4 text-sm text-ink-2">
      Photo moderation needs the service-role key for the active environment. Set{" "}
      <code className="font-mono text-xs">SUPABASE_SERVICE_ROLE_KEY_DEV</code> /{" "}
      <code className="font-mono text-xs">SUPABASE_SERVICE_ROLE_KEY_PROD</code> (server-only) -{" "}
      <code className="font-mono text-xs">public.photos</code> has no admin SELECT policy.
    </div>
  );
}

type ServiceClient = NonNullable<Awaited<ReturnType<typeof tryCreateServiceClient>>>;

function uniq(values: Array<string | null>): string[] {
  return Array.from(new Set(values.filter((v): v is string => typeof v === "string")));
}

async function resolveUploaderNames(
  supabase: ServiceClient,
  ids: string[],
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (ids.length === 0) return out;
  const { data } = await supabase.from("users").select("id, display_name, username").in("id", ids);
  for (const row of (data as Array<{ id: string; display_name: string | null; username: string | null }> | null) ?? []) {
    out[row.id] = row.display_name || row.username || "User";
  }
  return out;
}

async function resolveCourseNames(
  supabase: ServiceClient,
  ids: string[],
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (ids.length === 0) return out;
  const { data } = await supabase.from("courses").select("id, name").in("id", ids);
  for (const row of (data as Array<{ id: string; name: string }> | null) ?? []) {
    out[row.id] = row.name;
  }
  return out;
}

function prettyMod(state: PhotoModerationState): string {
  return state[0].toUpperCase() + state.slice(1);
}
