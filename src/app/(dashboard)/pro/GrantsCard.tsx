"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
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

const KIND_LABEL: Record<string, string> = {
  founding_beta: "Founding",
  comp: "Comp",
  promo: "Promo",
  manual: "Manual",
};

function when(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Non-Apple Pro entitlement: comps, promos, and the founding windows. These sit
 * alongside `pro_subscriptions` (the Apple mirror) as the second input to
 * `is_pro()` — which is why a grant can hand someone Pro without them ever
 * touching the App Store.
 */
export function GrantsCard({ grants }: { grants: GrantRow[] }) {
  const [username, setUsername] = useState("");
  const [kind, setKind] = useState<"comp" | "promo" | "manual">("comp");
  const [expires, setExpires] = useState("");
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
      if (result.ok) toast.success(result.message ?? "Revoked.");
      else toast.error(result.message);
    });
  }

  return (
    <div className="space-y-5 rounded-xl glass-panel p-5">
      <div>
        <h2 className="font-hero text-lg text-ink">Grants</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-2">
          Pro given directly, without the App Store — comps, promos, and founding windows. The
          server treats these exactly like a paid subscription.
        </p>
      </div>

      {/* Give someone Pro */}
      <div className="grid gap-3 rounded-lg border border-rule/70 bg-paper-sunken/40 p-4 sm:grid-cols-[1fr_auto_auto]">
        <input
          type="text"
          value={username}
          placeholder="@username"
          onChange={(e) => setUsername(e.target.value)}
          className="rounded-lg border border-rule/70 bg-paper-sunken/60 px-3 py-2 text-sm text-ink outline-none focus:border-brand/50"
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as typeof kind)}
          className="rounded-lg border border-rule/70 bg-paper-sunken/60 px-3 py-2 text-sm text-ink outline-none focus:border-brand/50"
        >
          <option value="comp">Comp</option>
          <option value="promo">Promo</option>
          <option value="manual">Manual</option>
        </select>
        <Button onClick={grant} disabled={pending || !username.trim()}>
          {pending ? "Working…" : "Grant Pro"}
        </Button>
        <input
          type="date"
          value={expires}
          onChange={(e) => setExpires(e.target.value)}
          className="rounded-lg border border-rule/70 bg-paper-sunken/60 px-3 py-2 text-sm text-ink outline-none focus:border-brand/50"
        />
        <input
          type="text"
          value={reason}
          placeholder="Reason (optional)"
          onChange={(e) => setReason(e.target.value)}
          className="rounded-lg border border-rule/70 bg-paper-sunken/60 px-3 py-2 text-sm text-ink outline-none focus:border-brand/50 sm:col-span-2"
        />
        <p className="text-[11px] leading-snug text-ink-3 sm:col-span-3">
          Leave the date blank for a lifetime grant.
        </p>
      </div>

      {/* The list */}
      {grants.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-3">
          No grants yet. The founding windows will appear here once you launch the perk.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule/70 text-left text-[10px] uppercase tracking-[0.16em] text-ink-3">
                <th className="py-2 pr-3 font-semibold">Who</th>
                <th className="py-2 pr-3 font-semibold">Kind</th>
                <th className="py-2 pr-3 font-semibold">Expires</th>
                <th className="py-2 pr-3 font-semibold">Reason</th>
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
                          Revoked
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setRevoking(g)}
                          disabled={pending}
                          className="text-[11px] uppercase tracking-wider text-alert hover:underline disabled:opacity-50"
                        >
                          Revoke
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
        title="Revoke this grant?"
        confirmLabel="Revoke"
        tone="danger"
        busy={pending}
        onConfirm={revoke}
        onCancel={() => {
          if (!pending) setRevoking(null);
        }}
      >
        <p>
          {revoking?.username ? `@${revoking.username}` : "This user"} loses Pro immediately —
          unless they also have a paid subscription, which is unaffected.
        </p>
      </ConfirmDialog>
    </div>
  );
}
