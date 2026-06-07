"use client";

import { useState, useTransition } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Minus,
  Pencil,
  Plus,
  Trash2,
  Archive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ChangeKind, EntityReport, SyncReport } from "@/lib/sync/engine";
import { applySync, dryRunSync } from "./actions";

type ConfigStatus = {
  devReady: boolean;
  prodReady: boolean;
  devUrlPresent: boolean;
  devKeyPresent: boolean;
  prodUrlPresent: boolean;
  prodKeyPresent: boolean;
};

export function SyncRunner({
  status,
  prodConfigured,
}: {
  status: ConfigStatus;
  prodConfigured: boolean;
}) {
  const [report, setReport] = useState<SyncReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [lastMode, setLastMode] = useState<"dry" | "apply" | null>(null);

  const ready = status.devReady && status.prodReady && prodConfigured;

  function runDry() {
    setError(null);
    setConfirming(false);
    startTransition(async () => {
      const res = await dryRunSync();
      setLastMode("dry");
      if (res.ok) setReport(res.report);
      else setError(res.message);
    });
  }

  function runApply() {
    setError(null);
    setConfirming(false);
    startTransition(async () => {
      const res = await applySync();
      setLastMode("apply");
      if (res.ok) setReport(res.report);
      else setError(res.message);
    });
  }

  if (!ready) {
    return <ConfigNeeded status={status} prodConfigured={prodConfigured} />;
  }

  const totalChanges = report
    ? report.entities.reduce(
        (n, e) => n + e.created + e.updated + e.deleted + e.archived,
        0,
      )
    : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={runDry} disabled={pending} variant="secondary">
          {pending && lastMode === "dry" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : null}
          Dry run
        </Button>

        {!confirming ? (
          <Button
            onClick={() => setConfirming(true)}
            disabled={pending}
            variant="destructive"
          >
            Apply to prod
            <ArrowRight className="size-4" />
          </Button>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full border border-alert/40 bg-alert/10 px-3 py-1.5 text-xs text-alert">
            <AlertTriangle className="size-3.5" />
            Overwrite prod editorial?
            <button
              onClick={runApply}
              disabled={pending}
              className="rounded-full bg-alert px-2.5 py-0.5 font-semibold text-white"
            >
              {pending && lastMode === "apply" ? "Applying…" : "Yes, apply"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={pending}
              className="rounded-full px-2 py-0.5 font-medium text-ink-2 hover:text-ink"
            >
              Cancel
            </button>
          </span>
        )}

        <span className="text-xs text-ink-3">dev → prod</span>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-alert/40 bg-alert/10 px-4 py-3 text-sm text-alert">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
          <p className="leading-relaxed">{error}</p>
        </div>
      )}

      {report && (
        <div className="space-y-4">
          <div
            className={cn(
              "flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm",
              report.mode === "apply"
                ? "border-brand/40 bg-brand/10 text-brand"
                : "border-border bg-paper-raised text-ink-2",
            )}
          >
            {report.mode === "apply" ? (
              <CheckCircle2 className="size-4" />
            ) : (
              <Pencil className="size-4" />
            )}
            <span>
              {report.mode === "apply" ? "Applied" : "Dry run"} ·{" "}
              {totalChanges === 0
                ? "no changes — prod already matches dev"
                : `${totalChanges} change${totalChanges === 1 ? "" : "s"}`}
            </span>
          </div>

          {report.entities.map((entity) => (
            <EntityCard key={entity.entity} entity={entity} />
          ))}
        </div>
      )}
    </div>
  );
}

function EntityCard({ entity }: { entity: EntityReport }) {
  const all: Array<{ label: string; n: number; kind: ChangeKind }> = [
    { label: "create", n: entity.created, kind: "create" },
    { label: "update", n: entity.updated, kind: "update" },
    { label: "delete", n: entity.deleted, kind: "delete" },
    { label: "archive", n: entity.archived, kind: "archive" },
    { label: "skip", n: entity.skipped, kind: "skip" },
  ];
  const totals = all.filter((t) => t.n > 0);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-paper-raised">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
        <h2 className="font-heading text-sm font-semibold text-ink">{entity.entity}</h2>
        <div className="flex flex-wrap items-center gap-1.5">
          {totals.length === 0 ? (
            <span className="text-xs text-ink-3">no changes</span>
          ) : (
            totals.map((t) => (
              <span
                key={t.label}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium tabular-nums",
                  kindChip(t.kind),
                )}
              >
                {kindIcon(t.kind)}
                {t.n} {t.label}
              </span>
            ))
          )}
        </div>
      </div>

      {entity.changes.length > 0 && (
        <ul className="divide-y divide-border/60">
          {entity.changes.map((c, i) => (
            <li key={i} className="flex items-start gap-2 px-4 py-2 text-xs">
              <span className={cn("mt-0.5 shrink-0", kindText(c.kind))}>{kindIcon(c.kind)}</span>
              <span className="min-w-0 flex-1">
                <span className="font-medium text-ink">{c.label}</span>
                {c.detail && <span className="text-ink-3"> — {c.detail}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}

      {entity.warnings.length > 0 && (
        <div className="space-y-1 border-t border-alert/30 bg-alert/5 px-4 py-2">
          {entity.warnings.map((w, i) => (
            <p key={i} className="flex items-start gap-1.5 text-[11px] text-alert">
              <AlertTriangle className="mt-0.5 size-3 shrink-0" />
              {w}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function kindIcon(kind: ChangeKind) {
  const cls = "size-3";
  switch (kind) {
    case "create":
      return <Plus className={cls} />;
    case "update":
      return <Pencil className={cls} />;
    case "delete":
      return <Trash2 className={cls} />;
    case "archive":
      return <Archive className={cls} />;
    default:
      return <Minus className={cls} />;
  }
}
function kindChip(kind: ChangeKind): string {
  switch (kind) {
    case "create":
      return "border-brand/40 bg-brand/10 text-brand";
    case "update":
      return "border-info/40 bg-info/10 text-info";
    case "delete":
      return "border-alert/40 bg-alert/10 text-alert";
    case "archive":
      return "border-bucket/40 bg-bucket/10 text-bucket";
    default:
      return "border-border bg-paper-sunken/60 text-ink-3";
  }
}
function kindText(kind: ChangeKind): string {
  switch (kind) {
    case "create":
      return "text-brand";
    case "update":
      return "text-info";
    case "delete":
      return "text-alert";
    case "archive":
      return "text-bucket";
    default:
      return "text-ink-3";
  }
}

function ConfigNeeded({
  status,
  prodConfigured,
}: {
  status: ConfigStatus;
  prodConfigured: boolean;
}) {
  const rows: Array<{ label: string; ok: boolean }> = [
    { label: "NEXT_PUBLIC_SUPABASE_URL_PROD (prod connection)", ok: prodConfigured },
    { label: "Dev URL (NEXT_PUBLIC_SUPABASE_URL[_DEV])", ok: status.devUrlPresent },
    { label: "SUPABASE_SERVICE_ROLE_KEY_DEV", ok: status.devKeyPresent },
    { label: "NEXT_PUBLIC_SUPABASE_URL_PROD", ok: status.prodUrlPresent },
    { label: "SUPABASE_SERVICE_ROLE_KEY_PROD", ok: status.prodKeyPresent },
  ];
  return (
    <div className="space-y-3 rounded-2xl border border-amber/40 bg-bucket/10 p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-ink">
        <AlertTriangle className="size-4 text-bucket" />
        Sync isn&apos;t configured yet
      </div>
      <p className="text-sm leading-relaxed text-ink-2">
        The mirror reads dev and writes prod using service-role keys held
        server-side (never in the repo). Set these in Vercel (and your local{" "}
        <code className="rounded bg-paper-sunken px-1">.env.local</code>) and reload:
      </p>
      <ul className="space-y-1 text-xs">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-2">
            {r.ok ? (
              <CheckCircle2 className="size-3.5 text-brand" />
            ) : (
              <AlertTriangle className="size-3.5 text-bucket" />
            )}
            <code className={cn("font-mono", r.ok ? "text-ink-3" : "text-ink")}>{r.label}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}
