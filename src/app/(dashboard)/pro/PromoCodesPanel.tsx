"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Ban, Copy, Infinity as InfinityIcon, Search, Ticket, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { EmptyState } from "@/components/admin/EmptyState";
import { cn } from "@/lib/utils";
import { createPromoCodes, revokePromoBatch, revokePromoCode } from "./actions";

export type PromoCodeRow = {
  id: string;
  code: string;
  /** null = forever. */
  durationMonths: number | null;
  label: string | null;
  batchId: string | null;
  createdAt: string;
  redeemedAt: string | null;
  redeemedUsername: string | null;
  revokedAt: string | null;
};

export type PromoBatchRow = {
  batchId: string | null;
  label: string | null;
  durationMonths: number | null;
  createdAt: string;
  total: number;
  redeemed: number;
  voided: number;
  unused: number;
};

type Status = "all" | "unused" | "redeemed" | "voided";

/** The one place a length becomes words. "Forever" is a length, not a kind. */
export function lengthLabel(months: number | null): string {
  if (months === null) return "Forever";
  return `${months} month${months === 1 ? "" : "s"}`;
}

function when(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusOf(c: PromoCodeRow): Exclude<Status, "all"> {
  if (c.redeemedAt) return "redeemed";
  if (c.revokedAt) return "voided";
  return "unused";
}

async function copy(text: string, note: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(note);
  } catch {
    toast.error("Couldn't reach the clipboard.");
  }
}

/* ------------------------------------------------------------------ */
/* Small shared pieces                                                  */
/* ------------------------------------------------------------------ */

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-brand/50 bg-brand/10 text-brand"
          : "border-border bg-surface-2 text-ink-2 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

/** The length badge that follows a code everywhere it's shown. */
function LengthBadge({ months }: { months: number | null }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
        months === null
          ? "border-amber/40 bg-amber/10 text-amber"
          : "border-rule/70 bg-paper-sunken/60 text-ink-2",
      )}
    >
      {months === null && <InfinityIcon aria-hidden className="size-3" />}
      {lengthLabel(months)}
    </span>
  );
}

/** How much of a batch has been taken up — the thing you actually want to know. */
function UsageBar({ batch }: { batch: PromoBatchRow }) {
  const pct = (n: number) => (batch.total === 0 ? 0 : (n / batch.total) * 100);
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-paper-sunken">
      <span className="bg-brand" style={{ width: `${pct(batch.redeemed)}%` }} />
      <span className="bg-ink-3/30" style={{ width: `${pct(batch.voided)}%` }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mint                                                                 */
/* ------------------------------------------------------------------ */

const LENGTHS: { label: string; months: number | null }[] = [
  { label: "1 month", months: 1 },
  { label: "3 months", months: 3 },
  { label: "6 months", months: 6 },
  { label: "12 months", months: 12 },
  { label: "Forever", months: null },
];

const COUNTS = [1, 5, 10, 25, 50];

function MintCard({ onMinted }: { onMinted: (codes: string[]) => void }) {
  // `custom` is a separate mode so "6 months" and a typed 6 can't fight.
  const [months, setMonths] = useState<number | null>(6);
  const [customMonths, setCustomMonths] = useState("");
  const [useCustomLength, setUseCustomLength] = useState(false);
  const [count, setCount] = useState(5);
  const [customCount, setCustomCount] = useState("");
  const [useCustomCount, setUseCustomCount] = useState(false);
  const [label, setLabel] = useState("");
  const [pending, startTransition] = useTransition();

  const resolvedMonths = useCustomLength ? Number(customMonths) : months;
  const resolvedCount = useCustomCount ? Number(customCount) : count;
  const lengthValid =
    !useCustomLength ||
    (Number.isInteger(resolvedMonths) && resolvedMonths !== null && resolvedMonths >= 1 && resolvedMonths <= 60);
  const countValid = Number.isInteger(resolvedCount) && resolvedCount >= 1 && resolvedCount <= 500;
  const valid = lengthValid && countValid;

  function mint() {
    if (!valid) return;
    startTransition(async () => {
      const result = await createPromoCodes(
        useCustomLength ? Number(customMonths) : months,
        resolvedCount,
        label || null,
      );
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      const minted = result.codes.map((c) => c.code);
      onMinted(minted);
      toast.success(`Minted ${minted.length} code${minted.length === 1 ? "" : "s"}.`);
    });
  }

  return (
    <div className="space-y-4 rounded-xl border border-rule/70 bg-paper-sunken/40 p-4">
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
          How long does it last?
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {LENGTHS.map((l) => (
            <Chip
              key={l.label}
              active={!useCustomLength && months === l.months}
              onClick={() => {
                setUseCustomLength(false);
                setMonths(l.months);
              }}
            >
              {l.label}
            </Chip>
          ))}
          <Chip active={useCustomLength} onClick={() => setUseCustomLength(true)}>
            Custom
          </Chip>
          {useCustomLength && (
            <span className="flex items-center gap-1.5 text-xs text-ink-2">
              <input
                type="number"
                min={1}
                max={60}
                autoFocus
                value={customMonths}
                onChange={(e) => setCustomMonths(e.target.value)}
                className="w-16 rounded-lg border border-rule/70 bg-paper-sunken/60 px-2 py-1 text-sm text-ink outline-none focus:border-brand/50"
              />
              months
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
          How many codes?
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {COUNTS.map((n) => (
            <Chip
              key={n}
              active={!useCustomCount && count === n}
              onClick={() => {
                setUseCustomCount(false);
                setCount(n);
              }}
            >
              {n}
            </Chip>
          ))}
          <Chip active={useCustomCount} onClick={() => setUseCustomCount(true)}>
            Custom
          </Chip>
          {useCustomCount && (
            <input
              type="number"
              min={1}
              max={500}
              autoFocus
              value={customCount}
              onChange={(e) => setCustomCount(e.target.value)}
              className="w-20 rounded-lg border border-rule/70 bg-paper-sunken/60 px-2 py-1 text-sm text-ink outline-none focus:border-brand/50"
            />
          )}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
          What are they for?
        </p>
        <input
          type="text"
          value={label}
          placeholder="Open day cards, Jack's mates, launch giveaway…"
          onChange={(e) => setLabel(e.target.value)}
          className="w-full rounded-lg border border-rule/70 bg-paper-sunken/60 px-3 py-2 text-sm text-ink outline-none focus:border-brand/50"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule/50 pt-3">
        {/* Say the whole thing back before it's real. */}
        <p className="text-sm text-ink-2">
          {valid ? (
            <>
              <strong className="text-ink">
                {resolvedCount} code{resolvedCount === 1 ? "" : "s"}
              </strong>
              , each worth{" "}
              <strong className="text-ink">
                {useCustomLength && lengthValid
                  ? lengthLabel(Number(customMonths))
                  : lengthLabel(months)}
              </strong>{" "}
              of Pro{months === null && !useCustomLength ? "" : ", one use each"}.
            </>
          ) : (
            <span className="text-alert">
              Length must be 1–60 months; batch size must be 1–500.
            </span>
          )}
        </p>
        <Button onClick={mint} disabled={pending || !valid}>
          {pending ? "Minting…" : "Mint codes"}
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The panel                                                            */
/* ------------------------------------------------------------------ */

/**
 * Promo codes — one kind of code, with a length.
 *
 * The shape follows how codes are actually used: you mint a **batch** for a
 * thing (an open day, a giveaway), hand it out, and later want to know how
 * much of it has been taken up — or kill what's left. So batches lead, and
 * the flat code ledger is the drill-down, not the front door.
 */
export function PromoCodesPanel({
  codes,
  batches,
  truncated,
}: {
  codes: PromoCodeRow[];
  batches: PromoBatchRow[];
  /** True when the ledger hit its fetch cap — say so rather than imply totality. */
  truncated: boolean;
}) {
  const [view, setView] = useState<"batches" | "codes">("batches");
  const [status, setStatus] = useState<Status>("all");
  const [search, setSearch] = useState("");
  const [batchFilter, setBatchFilter] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [revokingCode, setRevokingCode] = useState<PromoCodeRow | null>(null);
  const [revokingBatch, setRevokingBatch] = useState<PromoBatchRow | null>(null);

  const counts = useMemo(() => {
    const c = { all: codes.length, unused: 0, redeemed: 0, voided: 0 };
    for (const row of codes) c[statusOf(row)] += 1;
    return c;
  }, [codes]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return codes.filter((c) => {
      if (batchFilter && c.batchId !== batchFilter) return false;
      if (status !== "all" && statusOf(c) !== status) return false;
      if (!q) return true;
      return (
        c.code.toLowerCase().includes(q) ||
        (c.label ?? "").toLowerCase().includes(q) ||
        (c.redeemedUsername ?? "").toLowerCase().includes(q)
      );
    });
  }, [codes, status, search, batchFilter]);

  const activeBatch = batchFilter ? batches.find((b) => b.batchId === batchFilter) : undefined;

  function unusedIn(batchId: string | null): string[] {
    return codes.filter((c) => c.batchId === batchId && statusOf(c) === "unused").map((c) => c.code);
  }

  function openBatch(batch: PromoBatchRow) {
    setBatchFilter(batch.batchId);
    setStatus("all");
    setSearch("");
    setView("codes");
  }

  function revokeCode() {
    if (!revokingCode) return;
    const id = revokingCode.id;
    startTransition(async () => {
      const result = await revokePromoCode(id);
      setRevokingCode(null);
      if (result.ok) toast.success(result.message ?? "Voided.");
      else toast.error(result.message);
    });
  }

  function revokeBatch() {
    if (!revokingBatch?.batchId) return;
    const id = revokingBatch.batchId;
    startTransition(async () => {
      const result = await revokePromoBatch(id);
      setRevokingBatch(null);
      if (result.ok) toast.success(result.message ?? "Voided.");
      else toast.error(result.message);
    });
  }

  return (
    <div className="space-y-5">
      {/* Mint */}
      <section className="space-y-4 rounded-xl glass-panel p-5">
        <div>
          <h2 className="font-hero text-lg text-ink">Mint codes</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-2">
            One-time codes that hand over Vestige Pro for as long as you say. Users redeem them in
            the app under Vestige Pro &rarr; &ldquo;Have a code?&rdquo;. Each code works exactly
            once, and a code redeemed on top of a window already running adds its full length to
            the end of it.
          </p>
        </div>

        <MintCard
          onMinted={(minted) => {
            setFresh(minted);
            setBatchFilter(null);
            setView("batches");
          }}
        />

        {/* The one chance to grab the batch as a block. */}
        {fresh.length > 0 && (
          <div className="space-y-3 rounded-lg border border-brand/40 bg-brand/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-ink">
                Fresh batch — {fresh.length} code{fresh.length === 1 ? "" : "s"}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copy(fresh.join("\n"), "Codes copied.")}
                >
                  <Copy aria-hidden /> Copy all
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => setFresh([])} aria-label="Dismiss">
                  <X aria-hidden />
                </Button>
              </div>
            </div>
            <div className="grid gap-1 font-mono text-[13px] text-ink-2 sm:grid-cols-2 lg:grid-cols-3">
              {fresh.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => copy(code, `${code} copied.`)}
                  className="rounded px-2 py-1 text-left hover:bg-paper-sunken/60"
                  title="Copy"
                >
                  {code}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Ledger */}
      <section className="space-y-4 rounded-xl glass-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1" role="tablist">
            {(["batches", "codes"] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={cn(
                  "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium capitalize transition-colors",
                  view === v
                    ? "border-brand text-ink"
                    : "border-transparent text-ink-3 hover:text-ink-2",
                )}
              >
                {v === "batches" ? "Batches" : "All codes"}
              </button>
            ))}
          </div>
          <label className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-3"
            />
            <input
              type="search"
              value={search}
              placeholder="Find a code, label or redeemer"
              onChange={(e) => {
                setSearch(e.target.value);
                if (e.target.value) setView("codes");
              }}
              className="w-64 rounded-lg border border-rule/70 bg-paper-sunken/60 py-1.5 pl-8 pr-3 text-sm text-ink outline-none focus:border-brand/50"
            />
          </label>
        </div>

        {view === "batches" ? (
          batches.length === 0 ? (
            <EmptyState
              icon={Ticket}
              title="No codes yet"
              description="Mint a batch above and hand them out. Each batch keeps its own tally of what's been used."
            />
          ) : (
            <ul className="divide-y divide-rule/40">
              {batches.map((b) => (
                <li
                  key={b.batchId ?? "none"}
                  className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium text-ink">
                        {b.label ?? "Untitled batch"}
                      </span>
                      <LengthBadge months={b.durationMonths} />
                      <span className="text-xs text-ink-3">{when(b.createdAt)}</span>
                    </div>
                    <UsageBar batch={b} />
                    <p className="text-xs text-ink-3">
                      <span className="tabular-nums text-ink-2">{b.redeemed}</span> of{" "}
                      <span className="tabular-nums text-ink-2">{b.total}</span> redeemed
                      {b.voided > 0 && <> · {b.voided} voided</>}
                      {b.unused > 0 && <> · {b.unused} still out there</>}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => openBatch(b)}>
                      View codes
                    </Button>
                    {b.unused > 0 && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            copy(
                              unusedIn(b.batchId).join("\n"),
                              `Copied ${b.unused} unused code${b.unused === 1 ? "" : "s"}.`,
                            )
                          }
                        >
                          <Copy aria-hidden /> Copy unused
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={pending}
                          onClick={() => setRevokingBatch(b)}
                          aria-label="Void the unused codes in this batch"
                          title="Void unused"
                        >
                          <Ban aria-hidden className="text-alert" />
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {(["all", "unused", "redeemed", "voided"] as const).map((s) => (
                <Chip key={s} active={status === s} onClick={() => setStatus(s)}>
                  <span className="capitalize">{s === "all" ? "All" : s}</span>
                  <span className="ml-1 tabular-nums opacity-60">{counts[s]}</span>
                </Chip>
              ))}
              {activeBatch && (
                <button
                  type="button"
                  onClick={() => setBatchFilter(null)}
                  className="inline-flex items-center gap-1 rounded-full border border-brand/50 bg-brand/10 px-3 py-1 text-xs font-medium text-brand"
                  title="Clear the batch filter"
                >
                  {activeBatch.label ?? "Untitled batch"}
                  <X aria-hidden className="size-3" />
                </button>
              )}
            </div>

            {visible.length === 0 ? (
              <EmptyState
                icon={Search}
                title="Nothing matches"
                description="Try a different filter, or clear the search."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-rule/70 text-left text-[10px] uppercase tracking-[0.16em] text-ink-3">
                      <th className="py-2 pr-3 font-semibold">Code</th>
                      <th className="py-2 pr-3 font-semibold">Worth</th>
                      <th className="py-2 pr-3 font-semibold">Batch</th>
                      <th className="py-2 pr-3 font-semibold">Minted</th>
                      <th className="py-2 pr-3 font-semibold">Status</th>
                      <th className="py-2 font-semibold" />
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((c) => {
                      const st = statusOf(c);
                      return (
                        <tr key={c.id} className="border-b border-rule/40 last:border-0">
                          <td className="py-2.5 pr-3">
                            <button
                              type="button"
                              onClick={() => copy(c.code, `${c.code} copied.`)}
                              className={cn(
                                "font-mono text-[13px] hover:underline",
                                st === "voided" ? "text-ink-3 line-through" : "text-ink",
                              )}
                              title="Copy"
                            >
                              {c.code}
                            </button>
                          </td>
                          <td className="py-2.5 pr-3">
                            <LengthBadge months={c.durationMonths} />
                          </td>
                          <td className="max-w-[12rem] truncate py-2.5 pr-3 text-ink-3">
                            {c.label ?? "—"}
                          </td>
                          <td className="py-2.5 pr-3 tabular-nums text-ink-2">
                            {when(c.createdAt)}
                          </td>
                          <td className="py-2.5 pr-3">
                            {st === "voided" ? (
                              <span className="text-[11px] uppercase tracking-wider text-ink-3">
                                Voided
                              </span>
                            ) : st === "redeemed" ? (
                              <span className="text-ink-2">
                                {c.redeemedUsername ? `@${c.redeemedUsername}` : "Redeemed"}
                                <span className="text-ink-3"> · {when(c.redeemedAt)}</span>
                              </span>
                            ) : (
                              <span className="text-[11px] uppercase tracking-wider text-brand">
                                Unused
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 text-right">
                            {st === "unused" && (
                              <button
                                type="button"
                                onClick={() => setRevokingCode(c)}
                                disabled={pending}
                                className="text-[11px] uppercase tracking-wider text-alert hover:underline disabled:opacity-50"
                              >
                                Void
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {truncated && (
              <p className="text-[11px] text-ink-3">
                Showing the most recent 1,000 codes. Older ones are still valid — search by code to
                find one.
              </p>
            )}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={revokingCode !== null}
        title="Void this code?"
        confirmLabel="Void"
        tone="danger"
        busy={pending}
        onConfirm={revokeCode}
        onCancel={() => {
          if (!pending) setRevokingCode(null);
        }}
      >
        <p>
          {revokingCode?.code} stops working immediately. Anyone still holding it will see
          &ldquo;code not recognised&rdquo;. This can&rsquo;t be undone.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={revokingBatch !== null}
        title="Void the unused codes?"
        confirmLabel="Void them"
        tone="danger"
        busy={pending}
        onConfirm={revokeBatch}
        onCancel={() => {
          if (!pending) setRevokingBatch(null);
        }}
      >
        <p>
          All {revokingBatch?.unused} unused codes in{" "}
          {revokingBatch?.label ?? "this batch"} stop working immediately. Codes people have
          already redeemed are untouched - nobody loses Pro they were given.
        </p>
      </ConfirmDialog>
    </div>
  );
}
