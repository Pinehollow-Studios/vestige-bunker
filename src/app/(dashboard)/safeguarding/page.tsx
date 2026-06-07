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
    <div className="mx-auto max-w-5xl space-y-6">
      <SectionHeader
        eyebrow="People &amp; safety · Safeguarding"
        title="Safeguarding queue"
        description="Heuristic flags raised by the round-log trigger — review actions land in the next slice."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATES.map((state) => {
          const active = state === stateFilter;
          const count = stateCounts[state];
          const numClass =
            state === "pending" && count > 0
              ? "text-brand"
              : state === "reviewed_actioned" && count > 0
                ? "text-amber"
                : "text-ink";
          return (
            <a
              key={state}
              href={`/safeguarding?state=${state}`}
              className={
                "rounded-xl border bg-paper-raised/50 p-4 transition-colors " +
                (active
                  ? "border-brand text-ink"
                  : "border-rule/70 hover:bg-paper-raised/40")
              }
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
                {prettyState(state)}
              </p>
              <p className={"mt-2 font-hero text-3xl leading-none tabular-nums " + numClass}>
                {count}
              </p>
            </a>
          );
        })}
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-2">
              {prettyState(stateFilter)} flags
            </h2>
            <span className="text-[11px] tabular-nums text-ink-3">{rows.length}</span>
          </div>
          <KindFilter current={kindFilter} state={stateFilter} />
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title="Queue is clear"
            subtitle="No flags in this bucket."
          />
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => (
              <FlagRow key={row.flag_id} row={row} />
            ))}
          </ul>
        )}
      </section>

      {queueRes.error && (
        <div className="rounded-xl border border-alert/40 bg-alert/10 p-4 text-xs text-alert">
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
    <li className="rounded-xl border border-rule/70 bg-paper-raised/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <KindBadge kind={row.flag_kind} />
            <span className="font-medium text-ink">{name}</span>
            {row.username && row.display_name && (
              <span className="text-xs text-ink-3">@{row.username}</span>
            )}
            <AccountStatusBadge status={row.user_account_status} />
            {row.user_is_admin_hidden && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber">
                <ShieldAlert className="size-3" aria-hidden /> Hidden
              </span>
            )}
          </div>
          <p className="text-[11px] text-ink-3">
            Triggered {relativeTime(row.triggered_at)} · {row.user_round_count_30d}{" "}
            round{row.user_round_count_30d === 1 ? "" : "s"} in last 30d
          </p>
        </div>
        <code className="rounded-md border border-rule/70 bg-paper-sunken/60 px-2 py-1 font-mono text-[10px] text-ink-3">
          {row.flag_id.slice(0, 8)}…
        </code>
      </div>

      {row.evidence && Object.keys(row.evidence).length > 0 && (
        <pre className="mt-3 overflow-x-auto rounded-md border border-rule/70 bg-paper-sunken/60 px-3 py-2 font-mono text-[10px] leading-relaxed text-ink-2">
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
                ? "border-brand text-brand"
                : "border-rule/70 text-ink-3 hover:bg-paper-raised/40 hover:text-ink-2")
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
      ? "border-brand/40 text-brand"
      : kind === "impossible_geography"
        ? "border-info/40 text-info"
        : "border-amber/40 text-amber";
  return (
    <span
      className={
        "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider " +
        cls
      }
    >
      {prettyKind(kind)}
    </span>
  );
}

function AccountStatusBadge({ status }: { status: "active" | "restricted" | "suspended" }) {
  if (status === "active") return null;
  const cls = status === "suspended" ? "border-alert/40 text-alert" : "border-amber/40 text-amber";
  return (
    <span
      className={
        "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider " +
        cls
      }
    >
      {status}
    </span>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-rule/70 bg-paper-raised/50 px-4 py-12 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-brand/15 text-brand">
        <Shield className="size-5" aria-hidden />
      </span>
      <p className="display-serif text-lg text-ink">{title}</p>
      <p className="text-sm text-ink-2">{subtitle}</p>
    </div>
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
