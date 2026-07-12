"use client";

import { CheckCircle2, AlertTriangle, XCircle, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComplianceCheck } from "@/lib/email/compliance";

/**
 * The live compliance checklist — updates as Jack types. Green = good, amber =
 * worth fixing, red = legally missing (blocks sending). Sits in the composer so
 * an email can't quietly go out missing an unsubscribe link or postal address.
 */
export function CompliancePanel({ checks }: { checks: ComplianceCheck[] }) {
  const fails = checks.filter((c) => c.level === "fail").length;
  const warns = checks.filter((c) => c.level === "warn").length;

  return (
    <section className="rounded-xl border border-border bg-paper-raised/50 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
          <ShieldCheck className="size-3.5" /> Ready to send?
        </div>
        <span className={cn("text-xs font-medium", fails > 0 ? "text-alert" : warns > 0 ? "text-amber" : "text-emerald-600")}>
          {fails > 0 ? `${fails} to fix` : warns > 0 ? `${warns} to review` : "All good"}
        </span>
      </div>
      <ul className="space-y-1.5">
        {checks.map((c) => (
          <li key={c.id} className="flex items-start gap-2">
            <Icon level={c.level} />
            <div className="min-w-0">
              <p className={cn("text-sm font-medium", c.level === "fail" ? "text-alert" : "text-ink")}>{c.label}</p>
              <p className="text-xs leading-snug text-ink-3">{c.hint}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Icon({ level }: { level: ComplianceCheck["level"] }) {
  if (level === "pass") return <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />;
  if (level === "warn") return <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber" />;
  return <XCircle className="mt-0.5 size-4 shrink-0 text-alert" />;
}
