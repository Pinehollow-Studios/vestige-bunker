import { ClipboardCheck } from "lucide-react";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ScorecardState = "awaiting_review" | "in_review" | "approved" | "rejected";

type Row = {
  id: string;
  state: ScorecardState;
  uploader_user_id: string;
  round_id: string;
  scorecard_photo_id: string;
  reviewer_user_id: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
};

const STATES: ScorecardState[] = [
  "awaiting_review",
  "in_review",
  "approved",
  "rejected",
];

/**
 * Scorecard verification surface — read-only v1.
 *
 * Backed by the `scorecard_review_queue` table (migration
 * 20260512130000_scorecard_verification.sql). Surfaces the queue so
 * devs can see what's waiting; review controls (claim / approve /
 * reject) land with the iOS scorecard upload flow + the
 * admin_claim_scorecard_review / admin_approve_scorecard /
 * admin_reject_scorecard RPCs already in the migrations tree.
 */
export default async function ScorecardsPage() {
  const supabase = await createClient();
  const [stateCountsRes, openRes] = await Promise.all([
    Promise.all(
      STATES.map(async (state) => {
        const { count } = await supabase
          .from("scorecard_review_queue")
          .select("id", { count: "exact", head: true })
          .eq("state", state);
        return [state, count ?? 0] as const;
      }),
    ),
    supabase
      .from("scorecard_review_queue")
      .select("id, state, uploader_user_id, round_id, scorecard_photo_id, reviewer_user_id, review_note, reviewed_at, created_at")
      .in("state", ["awaiting_review", "in_review"])
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const stateCounts = Object.fromEntries(stateCountsRes) as Record<ScorecardState, number>;
  const open: Row[] = (openRes.data as Row[] | null) ?? [];
  const openCount = stateCounts.awaiting_review + stateCounts.in_review;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <SectionHeader
        eyebrow="Queues · Scorecards"
        title="Scorecard verification"
        description="Manual evidence path for rounds without GPS coverage. Reviewer confirms the photographed scorecard against entered scores. Review controls land alongside the iOS scorecard upload flow."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATES.map((state) => (
          <div
            key={state}
            className="surface-glass flex flex-col gap-2 rounded-2xl p-4"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
              {prettyState(state)}
            </p>
            <p
              className={
                "font-hero text-3xl leading-none tabular-nums " +
                (state === "awaiting_review" && stateCounts[state] > 0
                  ? "text-brand"
                  : state === "rejected" && stateCounts[state] > 0
                    ? "text-alert"
                    : "text-ink")
              }
            >
              {stateCounts[state]}
            </p>
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <header className="flex items-end justify-between border-b border-border/60 pb-2">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="size-4 text-brand" aria-hidden />
            <h2 className="font-heading text-sm font-semibold uppercase tracking-[0.14em] text-ink">
              Open queue
            </h2>
            <span className="text-[10px] tabular-nums text-ink-3">
              {openCount === 0 ? "0" : `${open.length} of ${openCount}`}
            </span>
          </div>
          <p className="hidden text-xs text-ink-3 sm:block">
            Read-only — claim &amp; approve actions ship next.
          </p>
        </header>

        {open.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border/70 bg-paper-raised/60 px-4 py-10 text-center text-sm text-ink-3">
            No scorecards awaiting review.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-paper-raised">
            <table className="w-full text-xs">
              <thead className="border-b border-border/60 bg-paper-sunken/50 text-left text-[10px] uppercase tracking-wider text-ink-3">
                <tr>
                  <th className="px-3 py-2 font-semibold">State</th>
                  <th className="px-3 py-2 font-semibold">Round</th>
                  <th className="px-3 py-2 font-semibold">Uploader</th>
                  <th className="px-3 py-2 font-semibold">Reviewer</th>
                  <th className="px-3 py-2 text-right font-semibold">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {open.map((row) => (
                  <tr key={row.id} className="hover:bg-paper-sunken/40">
                    <td className="px-3 py-2">
                      <StateChip state={row.state} />
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] text-ink-3">
                      {row.round_id.slice(0, 8)}…
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] text-ink-3">
                      {row.uploader_user_id.slice(0, 8)}…
                    </td>
                    <td className="px-3 py-2 text-ink-2">
                      {row.reviewer_user_id
                        ? <span className="font-mono text-[10px]">{row.reviewer_user_id.slice(0, 8)}…</span>
                        : "—"}
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

function StateChip({ state }: { state: ScorecardState }) {
  const cls =
    state === "awaiting_review"
      ? "bg-brand/15 text-brand"
      : state === "in_review"
        ? "bg-info/15 text-info"
        : state === "approved"
          ? "bg-paper-sunken text-ink-2"
          : "bg-alert/15 text-alert";
  return (
    <span className={"inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider " + cls}>
      {prettyState(state)}
    </span>
  );
}

function prettyState(state: ScorecardState): string {
  switch (state) {
    case "awaiting_review":
      return "Awaiting";
    case "in_review":
      return "In review";
    case "approved":
      return "Approved";
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
