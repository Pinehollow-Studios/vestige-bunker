"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { createPromoCodes, revokePromoCode } from "./actions";

export type PromoCodeRow = {
  id: string;
  code: string;
  kind: string;
  durationMonths: number | null;
  label: string | null;
  createdAt: string;
  redeemedAt: string | null;
  redeemedUsername: string | null;
  revokedAt: string | null;
};

function when(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function kindLabel(row: Pick<PromoCodeRow, "kind" | "durationMonths">): string {
  if (row.kind === "lifetime") return "Lifetime";
  const m = row.durationMonths ?? 0;
  return `Trial · ${m} month${m === 1 ? "" : "s"}`;
}

/**
 * One-time Pro promo codes. The server mints the words (WORD-WORD-NN from the
 * golf pools) and owns the one-time-use guarantee; redemption in the app turns
 * a code into a `pro_grants` row of kind `promo`. This card mints batches,
 * shows what's outstanding, and voids codes that shouldn't be out there.
 */
export function PromoCodesCard({ codes }: { codes: PromoCodeRow[] }) {
  const [kind, setKind] = useState<"trial" | "lifetime">("trial");
  const [months, setMonths] = useState("6");
  const [count, setCount] = useState("5");
  const [label, setLabel] = useState("");
  const [fresh, setFresh] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [revoking, setRevoking] = useState<PromoCodeRow | null>(null);

  function generate() {
    const monthsNum = kind === "trial" ? Number(months) : null;
    const countNum = Number(count);
    startTransition(async () => {
      const result = await createPromoCodes(kind, monthsNum, countNum, label || null);
      if (result.ok) {
        const minted = result.codes.map((c) => c.code);
        setFresh(minted);
        toast.success(`Minted ${minted.length} code${minted.length === 1 ? "" : "s"}.`);
      } else {
        toast.error(result.message);
      }
    });
  }

  function copyAll() {
    navigator.clipboard
      .writeText(fresh.join("\n"))
      .then(() => toast.success("Codes copied."))
      .catch(() => toast.error("Couldn't reach the clipboard."));
  }

  function copyOne(code: string) {
    navigator.clipboard
      .writeText(code)
      .then(() => toast.success(`${code} copied.`))
      .catch(() => toast.error("Couldn't reach the clipboard."));
  }

  function revoke() {
    if (!revoking) return;
    const id = revoking.id;
    startTransition(async () => {
      const result = await revokePromoCode(id);
      setRevoking(null);
      if (result.ok) toast.success(result.message ?? "Voided.");
      else toast.error(result.message);
    });
  }

  return (
    <div className="space-y-5 rounded-xl glass-panel p-5">
      <div>
        <h2 className="font-hero text-lg text-ink">Promo codes</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-2">
          One-time codes that hand out Pro — a timed trial or a lifetime membership. Users redeem
          them in the app under Vestige Pro → &ldquo;Have a code?&rdquo;. Each code works exactly
          once.
        </p>
      </div>

      {/* Mint a batch */}
      <div className="grid gap-3 rounded-lg border border-rule/70 bg-paper-sunken/40 p-4 sm:grid-cols-[auto_auto_auto_1fr_auto]">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as typeof kind)}
          className="rounded-lg border border-rule/70 bg-paper-sunken/60 px-3 py-2 text-sm text-ink outline-none focus:border-brand/50"
        >
          <option value="trial">Trial</option>
          <option value="lifetime">Lifetime</option>
        </select>
        {kind === "trial" && (
          <label className="flex items-center gap-2 text-sm text-ink-2">
            <input
              type="number"
              min={1}
              max={60}
              value={months}
              onChange={(e) => setMonths(e.target.value)}
              className="w-20 rounded-lg border border-rule/70 bg-paper-sunken/60 px-3 py-2 text-sm text-ink outline-none focus:border-brand/50"
            />
            months
          </label>
        )}
        <label className="flex items-center gap-2 text-sm text-ink-2">
          <input
            type="number"
            min={1}
            max={500}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className="w-20 rounded-lg border border-rule/70 bg-paper-sunken/60 px-3 py-2 text-sm text-ink outline-none focus:border-brand/50"
          />
          codes
        </label>
        <input
          type="text"
          value={label}
          placeholder="Label (optional) — e.g. Open day cards"
          onChange={(e) => setLabel(e.target.value)}
          className="rounded-lg border border-rule/70 bg-paper-sunken/60 px-3 py-2 text-sm text-ink outline-none focus:border-brand/50"
        />
        <Button onClick={generate} disabled={pending}>
          {pending ? "Minting…" : "Generate"}
        </Button>
      </div>

      {/* Freshly minted — the one chance to grab the batch as a block */}
      {fresh.length > 0 && (
        <div className="space-y-3 rounded-lg border border-brand/40 bg-brand/10 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">
              Fresh batch — {fresh.length} code{fresh.length === 1 ? "" : "s"}
            </p>
            <Button variant="outline" size="sm" onClick={copyAll}>
              Copy all
            </Button>
          </div>
          <div className="grid gap-1 font-mono text-[13px] text-ink-2 sm:grid-cols-2 lg:grid-cols-3">
            {fresh.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => copyOne(code)}
                className="rounded px-2 py-1 text-left hover:bg-paper-sunken/60"
                title="Copy"
              >
                {code}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* The ledger */}
      {codes.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-3">
          No codes yet. Mint a batch and hand them out.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule/70 text-left text-[10px] uppercase tracking-[0.16em] text-ink-3">
                <th className="py-2 pr-3 font-semibold">Code</th>
                <th className="py-2 pr-3 font-semibold">Grants</th>
                <th className="py-2 pr-3 font-semibold">Label</th>
                <th className="py-2 pr-3 font-semibold">Minted</th>
                <th className="py-2 pr-3 font-semibold">Status</th>
                <th className="py-2 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => {
                const revoked = c.revokedAt !== null;
                const redeemed = c.redeemedAt !== null;
                return (
                  <tr key={c.id} className="border-b border-rule/40 last:border-0">
                    <td className="py-2.5 pr-3">
                      <button
                        type="button"
                        onClick={() => copyOne(c.code)}
                        className={`font-mono text-[13px] hover:underline ${
                          revoked ? "text-ink-3 line-through" : "text-ink"
                        }`}
                        title="Copy"
                      >
                        {c.code}
                      </button>
                    </td>
                    <td className="py-2.5 pr-3 text-ink-2">{kindLabel(c)}</td>
                    <td className="max-w-[12rem] truncate py-2.5 pr-3 text-ink-3">
                      {c.label ?? "—"}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-ink-2">{when(c.createdAt)}</td>
                    <td className="py-2.5 pr-3">
                      {revoked ? (
                        <span className="text-[11px] uppercase tracking-wider text-ink-3">
                          Voided
                        </span>
                      ) : redeemed ? (
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
                      {!revoked && !redeemed && (
                        <button
                          type="button"
                          onClick={() => setRevoking(c)}
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

      <ConfirmDialog
        open={revoking !== null}
        title="Void this code?"
        confirmLabel="Void"
        tone="danger"
        busy={pending}
        onConfirm={revoke}
        onCancel={() => {
          if (!pending) setRevoking(null);
        }}
      >
        <p>
          {revoking?.code} stops working immediately. Anyone still holding it will see
          &ldquo;code not recognised&rdquo;. This can&rsquo;t be undone.
        </p>
      </ConfirmDialog>
    </div>
  );
}
