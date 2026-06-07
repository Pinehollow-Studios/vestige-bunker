import { ImageIcon } from "lucide-react";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PhotoModerationState = "pending" | "approved" | "rejected" | "flagged";
type PhotoKind = "roundPhoto" | "avatar";

type Row = {
  id: string;
  storage_key: string | null;
  kind: PhotoKind;
  moderation_state: PhotoModerationState;
  user_id: string | null;
  taken_at: string | null;
  created_at: string;
};

const MODERATION_BUCKETS: PhotoModerationState[] = [
  "pending",
  "approved",
  "rejected",
  "flagged",
];

/**
 * Photo moderation surface — read-only v1.
 *
 * Single-axis moderation queue. The verification axis on
 * `photos.verification_state` was dropped 2026-05-19 alongside the
 * rest of the round verification system (Vestige-ios migration
 * 20260519110000_drop_verification.sql) — integrity is now an admin
 * concern surfaced via /safeguarding, not a per-photo evidence tag.
 *
 * Approve / reject controls land with the moderation policy slice
 * (open question §16.13).
 */
export default async function PhotosPage() {
  const supabase = await createClient();
  const [modCountsRes, recentRes] = await Promise.all([
    Promise.all(
      MODERATION_BUCKETS.map(async (state) => {
        const { count } = await supabase
          .from("photos")
          .select("id", { count: "exact", head: true })
          .eq("moderation_state", state);
        return [state, count ?? 0] as const;
      }),
    ),
    supabase
      .from("photos")
      .select("id, storage_key, kind, moderation_state, user_id, taken_at, created_at")
      .eq("moderation_state", "pending")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const modCounts = Object.fromEntries(modCountsRes) as Record<PhotoModerationState, number>;
  const pending: Row[] = (recentRes.data as Row[] | null) ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <SectionHeader
        eyebrow="Queues · Photo moderation"
        title="Photo moderation"
        description="Single-axis moderation queue — counts and contents are live, approve / reject controls land next."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {MODERATION_BUCKETS.map((state) => (
          <StatTile
            key={state}
            label={prettyMod(state)}
            value={modCounts[state]}
            tone={
              state === "pending"
                ? "brand"
                : state === "rejected" || state === "flagged"
                  ? "alert"
                  : undefined
            }
          />
        ))}
      </div>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-2">
              Pending queue
            </h2>
            <span className="text-[11px] tabular-nums text-ink-3">
              {pending.length}
            </span>
          </div>
          <p className="text-xs text-ink-3">Read-only — actions ship next.</p>
        </div>

        {pending.length === 0 ? (
          <EmptyState
            title="Nothing to moderate"
            subtitle="No photos are awaiting review."
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {pending.map((row) => (
              <PhotoTile key={row.id} row={row} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PhotoTile({ row }: { row: Row }) {
  return (
    <figure className="overflow-hidden rounded-xl border border-rule/70 bg-paper-raised/50">
      <div className="flex aspect-square items-center justify-center bg-paper-sunken/60 text-ink-3">
        <ImageIcon className="size-6" aria-hidden />
      </div>
      <figcaption className="space-y-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-ink">{prettyKind(row.kind)}</span>
          <StateChip state={row.moderation_state} />
        </div>
        <p className="truncate font-mono text-[10px] text-ink-3">
          {row.storage_key ? truncate(row.storage_key, 28) : "—"}
        </p>
        <p className="text-[11px] tabular-nums text-ink-3">
          {row.taken_at ? relativeTime(row.taken_at) : "no exif"} · submitted{" "}
          {relativeTime(row.created_at)}
        </p>
      </figcaption>
    </figure>
  );
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "brand" | "amber" | "alert";
}) {
  const numClass =
    tone === "brand" && value > 0
      ? "text-brand"
      : tone === "alert" && value > 0
        ? "text-alert"
        : tone === "amber" && value > 0
          ? "text-amber"
          : "text-ink";
  return (
    <div className="rounded-xl border border-rule/70 bg-paper-raised/50 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
        {label}
      </p>
      <p className={"mt-2 font-hero text-3xl leading-none tabular-nums " + numClass}>
        {value.toLocaleString()}
      </p>
    </div>
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
        "inline-flex rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider " +
        cls
      }
    >
      {prettyMod(state)}
    </span>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-rule/70 bg-paper-raised/50 px-4 py-12 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-brand/15 text-brand">
        <ImageIcon className="size-5" aria-hidden />
      </span>
      <p className="display-serif text-lg text-ink">{title}</p>
      <p className="text-sm text-ink-2">{subtitle}</p>
    </div>
  );
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

function truncate(s: string, n: number): string {
  return s.length <= n ? s : "…" + s.slice(-n + 1);
}
