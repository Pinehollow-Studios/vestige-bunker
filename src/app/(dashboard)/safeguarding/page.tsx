import { Shield, ShieldAlert } from "lucide-react";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type FlagKind = "same_day_excess" | "impossible_geography" | "velocity_spike";
type FlagState = "pending" | "reviewed_clean" | "reviewed_actioned" | "auto_expired";

type Row = {
  flag_id: string;
  user_id: string;
  username: string | null;
  display_name: string | null;
  flag_kind: FlagKind;
  triggered_at: string;
  evidence: Record<string, unknown> | null;
  state: FlagState;
  user_account_status: "active" | "restricted" | "suspended";
  user_is_admin_hidden: boolean;
  is_admin_hidden_at: string | null;
  user_round_count_30d: number;
};

const STATES: FlagState[] = ["pending", "reviewed_clean", "reviewed_actioned", "auto_expired"];

/**
 * Safeguarding queue — read-only v1.
 *
 * Backed by `admin_safeguarding_queue()` (migration
 * 20260519140000_safeguarding_rpcs.sql). Lists every flag the
 * round-log trigger has raised, with state + evidence summary.
 * Hide-from-leaderboards / set-account-status / outreach controls
 * land next — they're all RPCs already in the migrations tree.
 */
export default async function SafeguardingPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; kind?: string }>;
}) {
  const params = await searchParams;
  const stateFilter = (params.state as FlagState | undefined) ?? "pending";
  const kindFilter = (params.kind as FlagKind | undefined) ?? null;

  const supabase = await createClient();
  const [stateCountsRes, queueRes] = await Promise.all([
    Promise.all(
      STATES.map(async (state) => {
        const { count } = await supabase
          .from("safeguarding_flags")
          .select("id", { count: "exact", head: true })
          .eq("state", state);
        return [state, count ?? 0] as const;
      }),
    ),
    supabase
      .rpc("admin_safeguarding_queue", {
        p_state_filter: stateFilter,
        p_kind_filter: kindFilter,
        p_limit: 100,
        p_offset: 0,
      })
      .returns<Row[]>(),
  ]);

  const stateCounts = Object.fromEntries(stateCountsRes) as Record<FlagState, number>;
  const rows: Row[] = (queueRes.data as Row[] | null) ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <SectionHeader
        eyebrow="People &amp; safety · Safeguarding"
        title="Safeguarding queue"
        description="Heuristic flags from the round-log trigger (same-day excess, impossible geography, velocity spike). Backed by admin_safeguarding_queue(). Hide-from-leaderboards, set-account-status, and outreach actions are wired in the next slice."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATES.map((state) => {
          const active = state === stateFilter;
          return (
            <a
              key={state}
              href={`/safeguarding?state=${state}`}
              className={
                "surface-glass flex flex-col gap-2 rounded-2xl p-4 transition-colors hover:border-brand/40 " +
                (active ? "ring-1 ring-brand/40" : "")
              }
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
                {prettyState(state)}
              </p>
              <p
                className={
                  "font-hero text-3xl leading-none tabular-nums " +
                  (state === "pending" && stateCounts[state] > 0
                    ? "text-brand"
                    : state === "reviewed_actioned" && stateCounts[state] > 0
                      ? "text-amber"
                      : "text-ink")
                }
              >
                {stateCounts[state]}
              </p>
            </a>
          );
        })}
      </div>

      <section className="space-y-3">
        <header className="flex items-end justify-between border-b border-border/60 pb-2">
          <div className="flex items-center gap-2">
            <Shield className="size-4 text-brand" aria-hidden />
            <h2 className="font-heading text-sm font-semibold uppercase tracking-[0.14em] text-ink">
              {prettyState(stateFilter)} flags
            </h2>
            <span className="text-[10px] tabular-nums text-ink-3">
              {rows.length}
            </span>
          </div>
          <KindFilter current={kindFilter} state={stateFilter} />
        </header>

        {rows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border/70 bg-paper-raised/60 px-4 py-10 text-center text-sm text-ink-3">
            No flags in this bucket.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <FlagRow key={row.flag_id} row={row} />
            ))}
          </ul>
        )}
      </section>

      {queueRes.error && (
        <div className="rounded-2xl border border-alert/40 bg-alert/10 p-4 text-xs text-alert">
          Failed to load safeguarding queue: {queueRes.error.message}.
        </div>
      )}
    </div>
  );
}

function FlagRow({ row }: { row: Row }) {
  const name =
    row.display_name && row.display_name.trim().length > 0
      ? row.display_name
      : `@${row.username ?? "unknown"}`;
  return (
    <li className="surface-glass rounded-2xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <KindBadge kind={row.flag_kind} />
            <span className="font-heading text-sm font-semibold text-ink">
              {name}
            </span>
            {row.username && row.display_name && (
              <span className="text-[11px] text-ink-3">@{row.username}</span>
            )}
            <AccountStatusBadge status={row.user_account_status} />
            {row.user_is_admin_hidden && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber">
                <ShieldAlert className="size-3" aria-hidden /> Hidden
              </span>
            )}
          </div>
          <p className="text-[11px] text-ink-3">
            Triggered {relativeTime(row.triggered_at)} ·{" "}
            {row.user_round_count_30d}{" "}
            round{row.user_round_count_30d === 1 ? "" : "s"} in last 30d
          </p>
        </div>
        <code className="rounded-md border border-border/60 bg-paper-sunken/60 px-2 py-1 font-mono text-[10px] text-ink-3">
          {row.flag_id.slice(0, 8)}…
        </code>
      </div>

      {row.evidence && Object.keys(row.evidence).length > 0 && (
        <pre className="mt-3 overflow-x-auto rounded-md border border-border/60 bg-paper-sunken/60 px-3 py-2 font-mono text-[10px] leading-relaxed text-ink-2">
{JSON.stringify(row.evidence, null, 2)}
        </pre>
      )}
    </li>
  );
}

function KindFilter({
  current,
  state,
}: {
  current: FlagKind | null;
  state: FlagState;
}) {
  const kinds: Array<{ key: FlagKind | null; label: string }> = [
    { key: null, label: "All kinds" },
    { key: "same_day_excess", label: "Same-day" },
    { key: "impossible_geography", label: "Geography" },
    { key: "velocity_spike", label: "Velocity" },
  ];
  return (
    <div className="hidden gap-1 sm:flex">
      {kinds.map((k) => {
        const active = current === k.key;
        const href = k.key
          ? `/safeguarding?state=${state}&kind=${k.key}`
          : `/safeguarding?state=${state}`;
        return (
          <a
            key={k.label}
            href={href}
            className={
              "rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-colors " +
              (active
                ? "border-brand/40 bg-brand/15 text-brand"
                : "border-border/60 bg-paper-sunken/40 text-ink-3 hover:bg-paper-sunken hover:text-ink-2")
            }
          >
            {k.label}
          </a>
        );
      })}
    </div>
  );
}

function KindBadge({ kind }: { kind: FlagKind }) {
  const cls =
    kind === "same_day_excess"
      ? "bg-brand/15 text-brand"
      : kind === "impossible_geography"
        ? "bg-info/15 text-info"
        : "bg-amber/15 text-amber";
  return (
    <span className={"inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider " + cls}>
      {prettyKind(kind)}
    </span>
  );
}

function AccountStatusBadge({ status }: { status: "active" | "restricted" | "suspended" }) {
  if (status === "active") return null;
  const cls = status === "suspended" ? "bg-alert/15 text-alert" : "bg-amber/15 text-amber";
  return (
    <span className={"inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider " + cls}>
      {status}
    </span>
  );
}

function prettyState(state: FlagState): string {
  switch (state) {
    case "pending":
      return "Pending";
    case "reviewed_clean":
      return "Reviewed · clean";
    case "reviewed_actioned":
      return "Reviewed · actioned";
    case "auto_expired":
      return "Auto-expired";
  }
}

function prettyKind(kind: FlagKind): string {
  switch (kind) {
    case "same_day_excess":
      return "Same-day excess";
    case "impossible_geography":
      return "Impossible geography";
    case "velocity_spike":
      return "Velocity spike";
  }
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMins = Math.round(diffMs / 60_000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.round(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return `${Math.round(diffDays / 30)}mo ago`;
}
