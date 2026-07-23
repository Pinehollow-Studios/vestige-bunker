"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronDown, Copy, Search, Ticket } from "lucide-react";
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

/**
 * The one place a length becomes words. "Forever" is a length, not a kind —
 * there is only one sort of code and this is the only thing that varies.
 */
export function lengthLabel(months: number | null): string {
  if (months === null) return "Pro forever";
  return `${months} month${months === 1 ? "" : "s"} of Pro`;
}

function when(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusOf(c: PromoCodeRow): "used" | "off" | "waiting" {
  if (c.redeemedAt) return "used";
  if (c.revokedAt) return "off";
  return "waiting";
}

async function copy(text: string, note: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(note);
  } catch {
    toast.error("Couldn't reach the clipboard.");
  }
}

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
        "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-brand/50 bg-brand/10 text-brand"
          : "border-border bg-surface-2 text-ink-2 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function Question({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-rule/70 text-xs font-semibold tabular-nums text-ink-3">
        {n}
      </span>
      <div className="min-w-0 flex-1 space-y-2.5">
        <p className="text-sm font-semibold text-ink">{title}</p>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Make codes — the main event                                          */
/* ------------------------------------------------------------------ */

const LENGTHS: { label: string; months: number | null }[] = [
  { label: "1 month", months: 1 },
  { label: "3 months", months: 3 },
  { label: "6 months", months: 6 },
  { label: "12 months", months: 12 },
  { label: "Forever", months: null },
];

const COUNTS = [1, 5, 10, 25, 50];

/**
 * Three questions and a button. Pro isn't on sale yet, so handing out codes is
 * the only thing this page really does — it gets the top of the page, the
 * biggest type, and no jargon.
 */
function MakeCodes({ onMade }: { onMade: (codes: string[]) => void }) {
  const [months, setMonths] = useState<number | null>(6);
  const [customMonths, setCustomMonths] = useState("");
  const [otherLength, setOtherLength] = useState(false);
  const [count, setCount] = useState(5);
  const [customCount, setCustomCount] = useState("");
  const [otherCount, setOtherCount] = useState(false);
  const [label, setLabel] = useState("");
  const [pending, startTransition] = useTransition();

  const chosenMonths = otherLength ? Number(customMonths) : months;
  const chosenCount = otherCount ? Number(customCount) : count;
  const lengthOk =
    !otherLength || (Number.isInteger(chosenMonths) && chosenMonths! >= 1 && chosenMonths! <= 60);
  const countOk = Number.isInteger(chosenCount) && chosenCount >= 1 && chosenCount <= 500;
  const ready = lengthOk && countOk;

  function make() {
    if (!ready) return;
    startTransition(async () => {
      const result = await createPromoCodes(
        otherLength ? Number(customMonths) : months,
        chosenCount,
        label || null,
      );
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      onMade(result.codes.map((c) => c.code));
    });
  }

  return (
    <section className="space-y-6 rounded-xl glass-panel p-6">
      <div>
        <h2 className="font-hero text-2xl text-ink">Make codes</h2>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-2">
          A code gives one person Vestige Pro. They type it into the app, under Vestige Pro &rarr;
          &ldquo;Have a code?&rdquo;. Each code works once, for one person.
        </p>
      </div>

      <div className="space-y-5">
        <Question n={1} title="How long do they get Pro for?">
          <div className="flex flex-wrap items-center gap-2">
            {LENGTHS.map((l) => (
              <Chip
                key={l.label}
                active={!otherLength && months === l.months}
                onClick={() => {
                  setOtherLength(false);
                  setMonths(l.months);
                }}
              >
                {l.label}
              </Chip>
            ))}
            <Chip active={otherLength} onClick={() => setOtherLength(true)}>
              Another length
            </Chip>
            {otherLength && (
              <span className="flex items-center gap-2 text-sm text-ink-2">
                <input
                  type="number"
                  min={1}
                  max={60}
                  autoFocus
                  value={customMonths}
                  onChange={(e) => setCustomMonths(e.target.value)}
                  className="w-16 rounded-lg border border-rule/70 bg-paper-sunken/60 px-2 py-1.5 text-sm text-ink outline-none focus:border-brand/50"
                />
                months
              </span>
            )}
          </div>
        </Question>

        <Question n={2} title="How many codes do you need?">
          <div className="flex flex-wrap items-center gap-2">
            {COUNTS.map((n) => (
              <Chip
                key={n}
                active={!otherCount && count === n}
                onClick={() => {
                  setOtherCount(false);
                  setCount(n);
                }}
              >
                {n}
              </Chip>
            ))}
            <Chip active={otherCount} onClick={() => setOtherCount(true)}>
              Another number
            </Chip>
            {otherCount && (
              <input
                type="number"
                min={1}
                max={500}
                autoFocus
                value={customCount}
                onChange={(e) => setCustomCount(e.target.value)}
                className="w-20 rounded-lg border border-rule/70 bg-paper-sunken/60 px-2 py-1.5 text-sm text-ink outline-none focus:border-brand/50"
              />
            )}
          </div>
        </Question>

        <Question n={3} title="What are these for?">
          <input
            type="text"
            value={label}
            placeholder="Open day at Woking, Jack's mates, launch giveaway…"
            onChange={(e) => setLabel(e.target.value)}
            className="w-full max-w-md rounded-lg border border-rule/70 bg-paper-sunken/60 px-3 py-2 text-sm text-ink outline-none focus:border-brand/50"
          />
          <p className="text-xs text-ink-3">
            Only you see this. It&rsquo;s how you&rsquo;ll find these codes again later.
          </p>
        </Question>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule/50 pt-4">
        <p className="text-sm text-ink-2">
          {ready ? (
            <>
              You&rsquo;ll get{" "}
              <strong className="text-ink">
                {chosenCount} code{chosenCount === 1 ? "" : "s"}
              </strong>
              . Each one gives whoever uses it{" "}
              <strong className="text-ink">
                {otherLength ? lengthLabel(Number(customMonths)) : lengthLabel(months)}
              </strong>
              .
            </>
          ) : (
            <span className="text-alert">
              A length has to be between 1 and 60 months, and you can make between 1 and 500 codes
              at a time.
            </span>
          )}
        </p>
        {/* The button says what will happen, not what it is. */}
        <Button size="lg" onClick={make} disabled={pending || !ready}>
          {pending
            ? "Making them…"
            : ready
              ? `Make ${chosenCount} code${chosenCount === 1 ? "" : "s"}`
              : "Make codes"}
        </Button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* The list                                                             */
/* ------------------------------------------------------------------ */

function StatusText({ code }: { code: PromoCodeRow }) {
  const s = statusOf(code);
  if (s === "off") return <span className="text-ink-3">Turned off</span>;
  if (s === "used") {
    return (
      <span className="text-ink-2">
        Used by {code.redeemedUsername ? `@${code.redeemedUsername}` : "someone"}
        <span className="text-ink-3"> · {when(code.redeemedAt)}</span>
      </span>
    );
  }
  return <span className="text-brand">Not used yet</span>;
}

/**
 * Everything already made. Groups lead — a group is one press of "Make codes",
 * which is how you actually think about them ("the 50 for the open day") — and
 * a group opens in place to show its codes. Typing in the search box switches
 * to a flat list of matches, because "has this code been used?" is the other
 * question people ask.
 */
function CodeList({
  codes,
  batches,
  truncated,
}: {
  codes: PromoCodeRow[];
  batches: PromoBatchRow[];
  truncated: boolean;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [turningOffCode, setTurningOffCode] = useState<PromoCodeRow | null>(null);
  const [turningOffBatch, setTurningOffBatch] = useState<PromoBatchRow | null>(null);

  const totals = useMemo(() => {
    const t = { total: codes.length, used: 0, waiting: 0, off: 0 };
    for (const c of codes) {
      const s = statusOf(c);
      if (s === "used") t.used += 1;
      else if (s === "off") t.off += 1;
      else t.waiting += 1;
    }
    return t;
  }, [codes]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return codes.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        (c.label ?? "").toLowerCase().includes(q) ||
        (c.redeemedUsername ?? "").toLowerCase().includes(q),
    );
  }, [codes, search]);

  function codesIn(batchId: string | null) {
    return codes.filter((c) => c.batchId === batchId);
  }

  function toggle(batchId: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(batchId)) next.delete(batchId);
      else next.add(batchId);
      return next;
    });
  }

  function turnOffCode() {
    if (!turningOffCode) return;
    const id = turningOffCode.id;
    startTransition(async () => {
      const result = await revokePromoCode(id);
      setTurningOffCode(null);
      if (result.ok) toast.success("That code won't work any more.");
      else toast.error(result.message);
    });
  }

  function turnOffBatch() {
    if (!turningOffBatch?.batchId) return;
    const id = turningOffBatch.batchId;
    startTransition(async () => {
      const result = await revokePromoBatch(id);
      setTurningOffBatch(null);
      if (result.ok) toast.success(result.message ?? "Done.");
      else toast.error(result.message);
    });
  }

  const codeRow = (c: PromoCodeRow) => (
    <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
      <button
        type="button"
        onClick={() => copy(c.code, `${c.code} copied.`)}
        className={cn(
          "font-mono text-[13px] hover:underline",
          statusOf(c) === "off" ? "text-ink-3 line-through" : "text-ink",
        )}
        title="Click to copy"
      >
        {c.code}
      </button>
      <span className="text-xs text-ink-3">{lengthLabel(c.durationMonths)}</span>
      <span className="ml-auto text-xs">
        <StatusText code={c} />
      </span>
      {statusOf(c) === "waiting" && (
        <button
          type="button"
          onClick={() => setTurningOffCode(c)}
          disabled={pending}
          className="text-xs text-alert hover:underline disabled:opacity-50"
        >
          Turn off
        </button>
      )}
    </li>
  );

  return (
    <section className="space-y-4 rounded-xl glass-panel p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-hero text-lg text-ink">Codes you&rsquo;ve made</h2>
          <p className="mt-1 text-sm text-ink-2">
            {totals.total === 0 ? (
              "Nothing yet."
            ) : (
              <>
                <span className="tabular-nums">{totals.total}</span> in total ·{" "}
                <span className="tabular-nums">{totals.used}</span> used ·{" "}
                <span className="tabular-nums">{totals.waiting}</span> still waiting to be used
                {totals.off > 0 && (
                  <>
                    {" "}
                    · <span className="tabular-nums">{totals.off}</span> turned off
                  </>
                )}
              </>
            )}
          </p>
        </div>
        {totals.total > 0 && (
          <label className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-3"
            />
            <input
              type="search"
              value={search}
              placeholder="Find a code or a name"
              onChange={(e) => setSearch(e.target.value)}
              className="w-60 rounded-lg border border-rule/70 bg-paper-sunken/60 py-1.5 pl-8 pr-3 text-sm text-ink outline-none focus:border-brand/50"
            />
          </label>
        )}
      </div>

      {totals.total === 0 ? (
        <EmptyState
          icon={Ticket}
          title="No codes yet"
          description="Make some above and hand them out. They'll all be listed here, so you can see who's used one."
        />
      ) : search.trim() ? (
        matches.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-3">
            Nothing matches &ldquo;{search.trim()}&rdquo;.
          </p>
        ) : (
          <ul className="divide-y divide-rule/40">{matches.map(codeRow)}</ul>
        )
      ) : (
        <ul className="divide-y divide-rule/40">
          {batches.map((b) => {
            const key = b.batchId ?? "none";
            const isOpen = open.has(key);
            const pct = (n: number) => (b.total === 0 ? 0 : (n / b.total) * 100);
            return (
              <li key={key} className="py-3.5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                  <button
                    type="button"
                    onClick={() => b.batchId && toggle(b.batchId)}
                    className="group min-w-0 flex-1 space-y-1.5 text-left"
                    aria-expanded={isOpen}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <ChevronDown
                        aria-hidden
                        className={cn(
                          "size-4 shrink-0 text-ink-3 transition-transform",
                          isOpen && "rotate-180",
                        )}
                      />
                      <span className="truncate font-medium text-ink group-hover:underline">
                        {b.label ?? "No name"}
                      </span>
                      <span className="text-xs text-ink-3">
                        {b.total} code{b.total === 1 ? "" : "s"} · {lengthLabel(b.durationMonths)} ·
                        made {when(b.createdAt)}
                      </span>
                    </div>
                    <div className="ml-6 flex h-1.5 max-w-md overflow-hidden rounded-full bg-paper-sunken">
                      <span className="bg-brand" style={{ width: `${pct(b.redeemed)}%` }} />
                      <span className="bg-ink-3/30" style={{ width: `${pct(b.voided)}%` }} />
                    </div>
                    <p className="ml-6 text-xs text-ink-3">
                      <span className="tabular-nums text-ink-2">{b.redeemed}</span> of{" "}
                      <span className="tabular-nums text-ink-2">{b.total}</span> used
                      {b.unused > 0 && <> · {b.unused} still waiting</>}
                      {b.voided > 0 && <> · {b.voided} turned off</>}
                    </p>
                  </button>
                  {b.unused > 0 && (
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          copy(
                            codesIn(b.batchId)
                              .filter((c) => statusOf(c) === "waiting")
                              .map((c) => c.code)
                              .join("\n"),
                            `Copied ${b.unused} unused code${b.unused === 1 ? "" : "s"}.`,
                          )
                        }
                      >
                        <Copy aria-hidden /> Copy the {b.unused} unused
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => setTurningOffBatch(b)}
                        className="text-alert"
                      >
                        Turn them off
                      </Button>
                    </div>
                  )}
                </div>

                {isOpen && (
                  <ul className="ml-6 mt-2 divide-y divide-rule/30 border-t border-rule/30">
                    {codesIn(b.batchId).map(codeRow)}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {truncated && (
        <p className="text-xs text-ink-3">
          Showing the 1,000 most recent codes. Older ones still work — search for one to find it.
        </p>
      )}

      <ConfirmDialog
        open={turningOffCode !== null}
        title="Turn off this code?"
        confirmLabel="Turn it off"
        tone="danger"
        busy={pending}
        onConfirm={turnOffCode}
        onCancel={() => {
          if (!pending) setTurningOffCode(null);
        }}
      >
        <p>
          {turningOffCode?.code} stops working straight away. Anyone who tries it will be told it
          isn&rsquo;t recognised. You can&rsquo;t turn it back on.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={turningOffBatch !== null}
        title={`Turn off ${turningOffBatch?.unused} codes?`}
        confirmLabel="Turn them off"
        tone="danger"
        busy={pending}
        onConfirm={turnOffBatch}
        onCancel={() => {
          if (!pending) setTurningOffBatch(null);
        }}
      >
        <p>
          The {turningOffBatch?.unused} unused codes from{" "}
          {turningOffBatch?.label ?? "this lot"} stop working straight away. Anyone who has
          already used one keeps their Pro - nobody loses anything.
        </p>
      </ConfirmDialog>
    </section>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Vestige Pro codes — the page's main job while Pro isn't on sale.
 *
 * One kind of code, with a length; "forever" is one of the lengths. Making them
 * comes first and looks like it matters, the freshly-made ones land right under
 * the button, and everything already made sits below that.
 */
export function PromoCodesPanel({
  codes,
  batches,
  truncated,
}: {
  codes: PromoCodeRow[];
  batches: PromoBatchRow[];
  /** True when the list hit its fetch cap — say so rather than imply totality. */
  truncated: boolean;
}) {
  const [fresh, setFresh] = useState<string[]>([]);

  return (
    <div className="space-y-5">
      <MakeCodes onMade={setFresh} />

      {/* Right under the button that made them. */}
      {fresh.length > 0 && (
        <section className="space-y-3 rounded-xl border border-brand/40 bg-brand/10 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-hero text-lg text-ink">
                Your {fresh.length} new code{fresh.length === 1 ? "" : "s"}
              </p>
              <p className="mt-0.5 text-sm text-ink-2">
                Click any code to copy it on its own. They&rsquo;re saved in the list below too.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => copy(fresh.join("\n"), "All copied.")}
            >
              <Copy aria-hidden /> Copy all {fresh.length}
            </Button>
          </div>
          <div className="grid gap-1 font-mono text-sm text-ink sm:grid-cols-2 lg:grid-cols-3">
            {fresh.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => copy(code, `${code} copied.`)}
                className="rounded px-2 py-1 text-left hover:bg-paper-sunken/60"
                title="Click to copy"
              >
                {code}
              </button>
            ))}
          </div>
        </section>
      )}

      <CodeList codes={codes} batches={batches} truncated={truncated} />
    </div>
  );
}
