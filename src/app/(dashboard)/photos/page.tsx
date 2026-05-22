import { ImageIcon } from "lucide-react";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PhotoModerationState = "pending" | "approved" | "rejected" | "flagged";
type PhotoVerificationState =
  | "unverified"
  | "autoVerifiedGeotag"
  | "adminVerified"
  | "rejected";

type Row = {
  id: string;
  storage_key: string | null;
  kind: string;
  moderation_state: PhotoModerationState;
  verification_state: PhotoVerificationState;
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

const VERIFICATION_BUCKETS: PhotoVerificationState[] = [
  "unverified",
  "autoVerifiedGeotag",
  "adminVerified",
  "rejected",
];

/**
 * Photo moderation surface — read-only v1.
 *
 * Surfaces the two-axis state per CLAUDE.md §6.1 (moderation_state +
 * verification_state) so devs can see what's in the queue, what's
 * been approved, and what fell into the auto-verified-geotag bucket
 * without dropping into Supabase. Approve/reject controls land with
 * the moderation policy slice (open question §16.13).
 */
export default async function PhotosPage() {
  const supabase = await createClient();
  const [modCountsRes, vCountsRes, recentRes] = await Promise.all([
    Promise.all(
      MODERATION_BUCKETS.map(async (state) => {
        const { count } = await supabase
          .from("photos")
          .select("id", { count: "exact", head: true })
          .eq("moderation_state", state);
        return [state, count ?? 0] as const;
      }),
    ),
    Promise.all(
      VERIFICATION_BUCKETS.map(async (state) => {
        const { count } = await supabase
          .from("photos")
          .select("id", { count: "exact", head: true })
          .eq("verification_state", state);
        return [state, count ?? 0] as const;
      }),
    ),
    supabase
      .from("photos")
      .select("id, storage_key, kind, moderation_state, verification_state, user_id, taken_at, created_at")
      .eq("moderation_state", "pending")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const modCounts = Object.fromEntries(modCountsRes) as Record<PhotoModerationState, number>;
  const vCounts = Object.fromEntries(vCountsRes) as Record<PhotoVerificationState, number>;
  const pending: Row[] = (recentRes.data as Row[] | null) ?? [];

  const pendingCount = modCounts.pending;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <SectionHeader
        eyebrow="Queues · Photo moderation"
        title="Photo moderation"
        description="Two-axis review (moderation_state + verification_state) per Fairways-ios §6.1. Approve/reject controls land with the moderation policy slice (open question §16.13). Counts and queue contents are live."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <BreakdownCard
          title="Moderation state"
          subtitle="Has a human-or-policy looked at it?"
          entries={MODERATION_BUCKETS.map((state) => ({
            label: prettyMod(state),
            count: modCounts[state],
            tone: state === "pending" ? "attention" : state === "rejected" || state === "flagged" ? "alert" : "default",
          }))}
        />
        <BreakdownCard
          title="Verification state"
          subtitle="Does it back up a round's evidence trail?"
          entries={VERIFICATION_BUCKETS.map((state) => ({
            label: prettyVer(state),
            count: vCounts[state],
            tone: state === "rejected" ? "alert" : state === "adminVerified" ? "good" : "default",
          }))}
        />
      </div>

      <section className="space-y-3">
        <header className="flex items-end justify-between border-b border-border/60 pb-2">
          <div className="flex items-center gap-2">
            <ImageIcon className="size-4 text-brand" aria-hidden />
            <h2 className="font-heading text-sm font-semibold uppercase tracking-[0.14em] text-ink">
              Pending queue
            </h2>
            <span className="text-[10px] tabular-nums text-ink-3">
              {pendingCount === 0 ? "0" : `${pending.length} of ${pendingCount}`}
            </span>
          </div>
          <p className="hidden text-xs text-ink-3 sm:block">
            Read-only — moderation actions ship next.
          </p>
        </header>

        {pending.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border/70 bg-paper-raised/60 px-4 py-10 text-center text-sm text-ink-3">
            No photos awaiting moderation.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-paper-raised">
            <table className="w-full text-xs">
              <thead className="border-b border-border/60 bg-paper-sunken/50 text-left text-[10px] uppercase tracking-wider text-ink-3">
                <tr>
                  <th className="px-3 py-2 font-semibold">Kind</th>
                  <th className="px-3 py-2 font-semibold">Storage key</th>
                  <th className="px-3 py-2 font-semibold">Verification</th>
                  <th className="px-3 py-2 font-semibold">Taken</th>
                  <th className="px-3 py-2 text-right font-semibold">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {pending.map((row) => (
                  <tr key={row.id} className="hover:bg-paper-sunken/40">
                    <td className="px-3 py-2 font-medium text-ink">{row.kind}</td>
                    <td className="px-3 py-2 font-mono text-[10px] text-ink-3">
                      {row.storage_key ? truncate(row.storage_key, 48) : "—"}
                    </td>
                    <td className="px-3 py-2 text-ink-2">
                      {prettyVer(row.verification_state)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-ink-3">
                      {row.taken_at ? relativeTime(row.taken_at) : "no exif"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink-3">
                      {relativeTime(row.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function BreakdownCard({
  title,
  subtitle,
  entries,
}: {
  title: string;
  subtitle: string;
  entries: Array<{ label: string; count: number; tone: "default" | "attention" | "alert" | "good" }>;
}) {
  return (
    <div className="surface-glass rounded-2xl p-5">
      <div className="space-y-1">
        <h3 className="font-heading text-sm font-semibold text-ink">{title}</h3>
        <p className="text-[11px] text-ink-3">{subtitle}</p>
      </div>
      <ul className="mt-4 space-y-2">
        {entries.map((entry) => (
          <li
            key={entry.label}
            className="flex items-center justify-between rounded-lg border border-border/60 bg-paper-sunken/40 px-3 py-2"
          >
            <span className="flex items-center gap-2 text-xs">
              <span
                aria-hidden
                className={
                  "size-1.5 rounded-full " +
                  (entry.tone === "attention"
                    ? "bg-brand"
                    : entry.tone === "alert"
                      ? "bg-alert"
                      : entry.tone === "good"
                        ? "bg-info"
                        : "bg-ink-3/60")
                }
              />
              <span className="text-ink-2">{entry.label}</span>
            </span>
            <span
              className={
                "font-hero text-lg tabular-nums " +
                (entry.tone === "attention"
                  ? "text-brand"
                  : entry.tone === "alert"
                    ? "text-alert"
                    : "text-ink")
              }
            >
              {entry.count}
            </span>
          </li>
        ))}
      </ul>
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

function prettyVer(state: PhotoVerificationState): string {
  switch (state) {
    case "unverified":
      return "Unverified";
    case "autoVerifiedGeotag":
      return "Auto · geotag";
    case "adminVerified":
      return "Admin verified";
    case "rejected":
      return "Rejected";
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
