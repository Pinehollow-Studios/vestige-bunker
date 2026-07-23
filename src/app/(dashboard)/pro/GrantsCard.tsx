"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { cn } from "@/lib/utils";
import { grantProToUsername, revokeProGrant } from "./actions";

export type GrantRow = {
  id: string;
  username: string | null;
  kind: string;
  expiresAt: string | null;
  reason: string | null;
  revokedAt: string | null;
  createdAt: string;
};

/** The database's words, in ours. `founding_beta` is set by the app, not here. */
const KIND_LABEL: Record<string, string> = {
  founding_beta: "Early member",
  comp: "A gift",
  promo: "A code or promotion",
  manual: "Something else",
};

function when(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** The quick lengths, mirroring the codes surface. `null` = forever. */
const LENGTHS: { label: string; months: number | null }[] = [
  { label: "1 month", months: 1 },
  { label: "3 months", months: 3 },
  { label: "6 months", months: 6 },
  { label: "12 months", months: 12 },
  { label: "Forever", months: null },
];

/** `yyyy-mm-dd`, N months out — the shape `<input type="date">` wants. */
function monthsFromNow(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">{label}</p>
      {children}
    </div>
  );
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

/**
 * Pro handed over without the App Store: gifts, redeemed codes, and the early
 * member windows. These are `pro_grants` rows — the second input to `is_pro()`
 * alongside `pro_subscriptions` (the Apple mirror), which is why someone can
 * have Pro having never bought anything.
 *
 * Written in the words the person using this page would use, not the schema's:
 * "give someone Pro", not "grant"; "take it back", not "revoke". The database
 * keeps its own vocabulary and `KIND_LABEL` does the translating.
 */
export function GrantsCard({ grants }: { grants: GrantRow[] }) {
  const [username, setUsername] = useState("");
  const [kind, setKind] = useState<"comp" | "promo" | "manual">("comp");
  const [expires, setExpires] = useState("");
  /** True once "Until a date" is chosen, so the chips stop claiming the value. */
  const [pickDate, setPickDate] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [revoking, setRevoking] = useState<GrantRow | null>(null);

  function grant() {
    startTransition(async () => {
      const result = await grantProToUsername(username, kind, expires || null, reason || null);
      if (result.ok) {
        toast.success(result.message ?? "Granted.");
        setUsername("");
        setReason("");
        setExpires("");
        setPickDate(false);
      } else {
        toast.error(result.message);
      }
    });
  }

  function revoke() {
    if (!revoking) return;
    const id = revoking.id;
    startTransition(async () => {
      const result = await revokeProGrant(id);
      setRevoking(null);
      if (result.ok) toast.success(result.message ?? "Taken back.");
      else toast.error(result.message);
    });
  }

  return (
    <div className="space-y-5 rounded-xl glass-panel p-5">
      <div>
        <h2 className="font-hero text-lg text-ink">Give someone Pro directly</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-2">
          No code needed - type their username and they have Pro the next time the app checks.
          It counts exactly the same as paying for it. Everything given out this way is listed
          below, including codes people have used and early members&rsquo; free months.
        </p>
      </div>

      {/* Give someone Pro — same mental model as a code: a length, and
          "forever" is one of the lengths. */}
      <div className="space-y-4 rounded-lg border border-rule/70 bg-paper-sunken/40 p-4">
        <Field label="Who gets it?">
          <input
            type="text"
            value={username}
            placeholder="@username"
            onChange={(e) => setUsername(e.target.value)}
            className="w-full max-w-xs rounded-lg border border-rule/70 bg-paper-sunken/60 px-3 py-2 text-sm text-ink outline-none focus:border-brand/50"
          />
        </Field>

        <Field label="How long do they get it for?">
          <div className="flex flex-wrap items-center gap-1.5">
            {LENGTHS.map((l) => (
              <Chip
                key={l.label}
                active={!pickDate && expires === (l.months === null ? "" : monthsFromNow(l.months))}
                onClick={() => {
                  setPickDate(false);
                  setExpires(l.months === null ? "" : monthsFromNow(l.months));
                }}
              >
                {l.label}
              </Chip>
            ))}
            <Chip active={pickDate} onClick={() => setPickDate(true)}>
              Until a date
            </Chip>
            {pickDate && (
              <input
                type="date"
                value={expires}
                onChange={(e) => setExpires(e.target.value)}
                className="rounded-lg border border-rule/70 bg-paper-sunken/60 px-2 py-1 text-sm text-ink outline-none focus:border-brand/50"
              />
            )}
          </div>
        </Field>

        <Field label="Why are they getting it?">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
              className="rounded-lg border border-rule/70 bg-paper-sunken/60 px-3 py-2 text-sm text-ink outline-none focus:border-brand/50"
            >
              <option value="comp">A gift</option>
              <option value="promo">A code or promotion</option>
              <option value="manual">Something else</option>
            </select>
            <input
              type="text"
              value={reason}
              placeholder="Note to yourself (optional) - shows in the list below"
              onChange={(e) => setReason(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-rule/70 bg-paper-sunken/60 px-3 py-2 text-sm text-ink outline-none focus:border-brand/50"
            />
          </div>
        </Field>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule/50 pt-3">
          <p className="text-sm text-ink-2">
            <strong className="text-ink">{username.trim() ? `@${username.trim().replace(/^@/, "")}` : "Nobody yet"}</strong>{" "}
            {expires ? (
              <>gets Pro until <strong className="text-ink">{when(expires)}</strong>.</>
            ) : (
              <>gets Pro <strong className="text-ink">for good</strong>.</>
            )}
          </p>
          <Button onClick={grant} disabled={pending || !username.trim()}>
            {pending ? "Working…" : "Give them Pro"}
          </Button>
        </div>
      </div>

      {/* The list */}
      {grants.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-3">
          Nobody has been given Pro yet. Codes people use, gifts, and early members’ free months will all show up here.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule/70 text-left text-[10px] uppercase tracking-[0.16em] text-ink-3">
                <th className="py-2 pr-3 font-semibold">Who</th>
                <th className="py-2 pr-3 font-semibold">Why</th>
                <th className="py-2 pr-3 font-semibold">Until</th>
                <th className="py-2 pr-3 font-semibold">Note</th>
                <th className="py-2 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {grants.map((g) => {
                const revoked = g.revokedAt !== null;
                return (
                  <tr key={g.id} className="border-b border-rule/40 last:border-0">
                    <td className="py-2.5 pr-3">
                      <span className={revoked ? "text-ink-3 line-through" : "text-ink"}>
                        {g.username ? `@${g.username}` : "—"}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-ink-2">{KIND_LABEL[g.kind] ?? g.kind}</td>
                    <td className="py-2.5 pr-3 tabular-nums text-ink-2">{when(g.expiresAt)}</td>
                    <td className="max-w-[18rem] truncate py-2.5 pr-3 text-ink-3">
                      {g.reason ?? "—"}
                    </td>
                    <td className="py-2.5 text-right">
                      {revoked ? (
                        <span className="text-[11px] uppercase tracking-wider text-ink-3">
                          Taken back
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setRevoking(g)}
                          disabled={pending}
                          className="text-[11px] uppercase tracking-wider text-alert hover:underline disabled:opacity-50"
                        >
                          Take it back
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
        title="Take Pro back?"
        confirmLabel="Take it back"
        tone="danger"
        busy={pending}
        onConfirm={revoke}
        onCancel={() => {
          if (!pending) setRevoking(null);
        }}
      >
        <p>
          {revoking?.username ? `@${revoking.username}` : "This person"} loses Pro straight
          away. If they have also paid for it in the App Store, that is untouched - they keep
          Pro either way.
        </p>
      </ConfirmDialog>
    </div>
  );
}
