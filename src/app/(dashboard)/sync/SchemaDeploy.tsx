"use client";

import { useEffect, useState, useTransition } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  GitBranch,
  Loader2,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MigrationStatus } from "@/lib/sync/migrations";
import type { WorkflowRun } from "@/lib/github/dispatch";
import { deploySchemaToProd, getLatestProdRun, getSchemaStatus } from "./actions";

type Initial = {
  status: MigrationStatus;
  githubReady: boolean;
  latestRun: WorkflowRun | null;
};

export function SchemaDeploy({ initial }: { initial: Initial }) {
  const [status, setStatus] = useState<MigrationStatus>(initial.status);
  const [run, setRun] = useState<WorkflowRun | null>(initial.latestRun);
  const [confirming, setConfirming] = useState(false);
  const [withFunctions, setWithFunctions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [polling, setPolling] = useState(false);

  // Poll the run while one is in flight.
  useEffect(() => {
    if (!polling) return;
    const t = setInterval(async () => {
      const r = await getLatestProdRun();
      setRun(r);
      if (r && r.status === "completed") {
        setPolling(false);
        // refresh the diff once the run finishes
        const s = await getSchemaStatus();
        if (s.ok) setStatus(s.status);
      }
    }, 5000);
    return () => clearInterval(t);
  }, [polling]);

  const ledger = status.prodLedgerAvailable;
  const canPush = initial.githubReady && (!ledger || status.pushableCount > 0 || withFunctions);

  function push() {
    setError(null);
    setConfirming(false);
    startTransition(async () => {
      const res = await deploySchemaToProd({ migrations: true, functions: withFunctions });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setPolling(true);
      // grab the freshly-created run after a beat
      setTimeout(async () => setRun(await getLatestProdRun()), 2500);
    });
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-paper-raised p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-ink">
        <GitBranch className="size-4 text-brand" />
        Schema &amp; functions
      </div>

      {status.error && (
        <Banner tone="alert">{status.error}</Banner>
      )}

      {!initial.githubReady && (
        <Banner tone="amber">
          <span className="font-semibold">GitHub not wired.</span> Set{" "}
          <code className="rounded bg-paper-sunken px-1">GITHUB_DISPATCH_TOKEN</code> (+ the prod
          Supabase secrets on the iOS repo) so this button can run the prod-deploy workflow.
        </Banner>
      )}

      {/* Migration diff */}
      {!ledger && !status.error ? (
        <Banner tone="info">
          Prod migration ledger isn&apos;t readable yet — the{" "}
          <code className="rounded bg-paper-sunken px-1">admin_applied_migrations</code> RPC
          hasn&apos;t reached prod. The first schema push establishes it (all pending migrations
          apply, excluding any held). Dev has {status.devCount} migrations applied.
        </Banner>
      ) : (
        !status.error && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Pill>{status.pending.length} pending</Pill>
              <Pill tone="brand">{status.pushableCount} pushable</Pill>
              {status.heldCount > 0 && <Pill tone="amber">{status.heldCount} held</Pill>}
              <span className="text-ink-3">
                dev {status.devCount} · prod {status.prodCount}
              </span>
            </div>
            {status.pending.length === 0 ? (
              <p className="text-sm text-ink-2">Prod is up to date with dev. Nothing to push.</p>
            ) : (
              <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border">
                {status.pending.map((m) => (
                  <li
                    key={m.version}
                    className="flex items-start gap-2 px-3 py-2 text-xs"
                  >
                    {m.held ? (
                      <Lock className="mt-0.5 size-3.5 shrink-0 text-amber" />
                    ) : (
                      <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-brand" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="font-mono text-ink-3">{m.version}</span>{" "}
                      <span className="text-ink">{m.name}</span>
                      {m.held && (
                        <span className="ml-1 font-medium text-amber">
                          — held (would break the live build; un-hold after the next app release)
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      )}

      {/* Functions toggle */}
      <label className="flex items-center gap-2 text-xs text-ink-2">
        <input
          type="checkbox"
          checked={withFunctions}
          onChange={(e) => setWithFunctions(e.target.checked)}
          className="size-3.5"
        />
        also deploy Edge Functions (process-photo · sentry-webhook · delete-account)
      </label>

      {/* Push controls */}
      <div className="flex flex-wrap items-center gap-3">
        {!confirming ? (
          <Button onClick={() => setConfirming(true)} disabled={!canPush || pending} variant="destructive">
            Push to prod
            <ArrowRight className="size-4" />
          </Button>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full border border-alert/40 bg-alert/10 px-3 py-1.5 text-xs text-alert">
            <AlertTriangle className="size-3.5" />
            Run the prod-deploy workflow now?
            <button
              onClick={push}
              disabled={pending}
              className="rounded-full bg-alert px-2.5 py-0.5 font-semibold text-white"
            >
              {pending ? "Dispatching…" : "Yes, push"}
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
        <span className="text-xs text-ink-3">held migrations are excluded automatically</span>
      </div>

      {error && <Banner tone="alert">{error}</Banner>}

      {/* Run status */}
      {run && (
        <a
          href={run.htmlUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-xl border border-border bg-paper-sunken/50 px-3 py-2 text-xs text-ink-2 hover:text-ink"
        >
          {run.status === "completed" ? (
            run.conclusion === "success" ? (
              <CheckCircle2 className="size-4 text-brand" />
            ) : (
              <AlertTriangle className="size-4 text-alert" />
            )
          ) : (
            <Loader2 className="size-4 animate-spin text-brand" />
          )}
          <span className="flex-1">
            Latest prod-deploy run: {run.status}
            {run.conclusion ? ` · ${run.conclusion}` : ""}
          </span>
          <ExternalLink className="size-3 text-ink-3" />
        </a>
      )}
    </div>
  );
}

function Pill({ children, tone }: { children: React.ReactNode; tone?: "brand" | "amber" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 font-medium tabular-nums",
        tone === "brand"
          ? "border-brand/40 bg-brand/10 text-brand"
          : tone === "amber"
            ? "border-amber/40 bg-amber/10 text-amber"
            : "border-border bg-paper-sunken/60 text-ink-2",
      )}
    >
      {children}
    </span>
  );
}

function Banner({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "alert" | "amber" | "info";
}) {
  const cls =
    tone === "alert"
      ? "border-alert/40 bg-alert/10 text-alert"
      : tone === "amber"
        ? "border-amber/40 bg-amber/10 text-amber"
        : "border-info/40 bg-info/10 text-info";
  return (
    <div className={cn("flex items-start gap-2 rounded-xl border px-3 py-2 text-xs leading-relaxed", cls)}>
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  );
}
