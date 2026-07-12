"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Bug,
  CircleAlert,
  CircleCheck,
  Clock,
  DatabaseBackup,
  Image as ImageIcon,
  KeyRound,
  type LucideIcon,
  Radio,
  RotateCw,
  Send,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types (shared with the server page) ────────────────────────────────

export type Status = "ok" | "warn" | "fail";
export type Check = { id: string; label: string; status: Status; detail: string };
export type Job = {
  jobname: string;
  schedule: string;
  active: boolean;
  last_status: string | null;
  last_start: string | null;
  status: Status;
};
export type Metrics = {
  crashes_24h: number;
  crashes_7d: number;
  http_24h: number;
  http_failed_24h: number;
  photos_pending: number;
};
export type HttpPoint = { hour: string; total: number; failed: number };

// ── Dashboard (infrastructure / ops — distinct from the product Overview) ─

export function HealthDashboard({
  checks,
  jobs,
  metrics,
  httpSeries,
  generatedAt,
}: {
  checks: Check[];
  jobs: Job[];
  metrics: Metrics | null;
  httpSeries: HttpPoint[];
  generatedAt: string;
}) {
  const router = useRouter();
  const [auto, setAuto] = useState(true);
  const [pending, start] = useTransition();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    if (!auto) return;
    const i = setInterval(() => router.refresh(), 30000);
    return () => clearInterval(i);
  }, [auto, router]);

  const all: Status[] = [...checks.map((c) => c.status), ...jobs.map((j) => j.status)];
  const green = all.filter((s) => s === "ok").length;
  const fails = all.filter((s) => s === "fail").length;
  const warns = all.filter((s) => s === "warn").length;
  const overall: Status = fails ? "fail" : warns ? "warn" : "ok";
  const jobsOk = jobs.filter((j) => j.status === "ok").length;

  return (
    <div className="space-y-6">
      {/* Top bar. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">
            <span aria-hidden className="size-1.5 rounded-full bg-brand" />
            Operations · infrastructure
          </p>
          <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight text-ink sm:text-[1.75rem]">
            System health
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAuto((a) => !a)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              auto ? "border-brand/40 bg-brand/10 text-brand" : "border-rule/70 bg-paper-sunken/50 text-ink-3",
            )}
          >
            <span className="relative flex size-2">
              {auto && (
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand/60 motion-reduce:hidden" />
              )}
              <span className={cn("relative inline-flex size-2 rounded-full", auto ? "bg-brand" : "bg-ink-3")} />
            </span>
            {auto ? "Live" : "Paused"}
          </button>
          <span className="hidden text-xs text-ink-3 sm:inline">updated {ago(generatedAt, now)}</span>
          <button
            type="button"
            onClick={() => start(() => router.refresh())}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rule/70 bg-paper-sunken/50 px-2.5 py-1.5 text-xs font-medium text-ink-2 transition-colors hover:text-ink disabled:opacity-50"
          >
            <RotateCw className={cn("size-3.5", pending && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      <StatusHero overall={overall} green={green} total={all.length} warns={warns} fails={fails} />

      {/* Infra KPIs — throughput, reliability, scheduling, pipeline. */}
      {metrics && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi
            icon={Radio}
            label="Requests · 24h"
            value={metrics.http_24h}
            sub={metrics.http_failed_24h > 0 ? `${metrics.http_failed_24h} failed` : "all delivered"}
            tone={metrics.http_failed_24h > 0 ? "warn" : undefined}
          />
          <Kpi
            icon={Bug}
            label="Crashes · 24h"
            value={metrics.crashes_24h}
            sub={`${metrics.crashes_7d} in 7 days`}
            tone={metrics.crashes_24h > 0 ? "alert" : undefined}
          />
          <Kpi
            icon={Clock}
            label="Jobs healthy"
            value={jobsOk}
            sub={`of ${jobs.length} scheduled`}
            tone={jobsOk < jobs.length ? "warn" : undefined}
          />
          <Kpi
            icon={ImageIcon}
            label="Photo backlog"
            value={metrics.photos_pending}
            sub={metrics.photos_pending > 0 ? "awaiting processing" : "pipeline clear"}
            tone={metrics.photos_pending > 0 ? "warn" : undefined}
          />
        </div>
      )}

      <TrafficStrip series={httpSeries} total24h={metrics?.http_24h ?? 0} failed24h={metrics?.http_failed_24h ?? 0} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ChecksPanel checks={checks} />
        <JobsPanel jobs={jobs} now={now} />
      </div>

      <p className="text-xs text-ink-3">
        Infrastructure only — product metrics live on the <span className="text-ink-2">Overview</span> and{" "}
        <span className="text-ink-2">Analytics</span>. Auto-refreshes every 30s. A 15-minute alerter posts to
        Slack/Discord on any failure once an <code className="font-mono">ops_alert_webhook</code> vault secret is set.
      </p>
    </div>
  );
}

// ── Status hero ────────────────────────────────────────────────────────

function StatusHero({
  overall,
  green,
  total,
  warns,
  fails,
}: {
  overall: Status;
  green: number;
  total: number;
  warns: number;
  fails: number;
}) {
  const cfg = {
    ok: { title: "All systems operational", tint: "text-brand", glow: "var(--brand)", ring: "border-brand/25" },
    warn: { title: "Minor degradation", tint: "text-amber", glow: "#d9a441", ring: "border-amber/25" },
    fail: { title: "Issues need attention", tint: "text-alert", glow: "#e2483d", ring: "border-alert/25" },
  }[overall];
  const pct = total ? Math.round((green / total) * 100) : 100;

  return (
    <div className={cn("relative overflow-hidden rounded-3xl border bg-paper-raised/50 p-6 sm:p-8", cfg.ring)}>
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full opacity-[0.16] blur-3xl"
        style={{ background: cfg.glow }}
      />
      <div className="relative flex flex-wrap items-center gap-6">
        <StatusOrb overall={overall} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">System status</p>
          <p className={cn("mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl", cfg.tint)}>{cfg.title}</p>
          <p className="mt-1 text-sm text-ink-2">
            <span className="font-semibold text-ink">{green}</span> of{" "}
            <span className="font-semibold text-ink">{total}</span> systems healthy
            {warns > 0 && <span className="text-amber"> · {warns} warning{warns === 1 ? "" : "s"}</span>}
            {fails > 0 && <span className="text-alert"> · {fails} down</span>}
          </p>
        </div>
        <HealthRing pct={pct} status={overall} />
      </div>
    </div>
  );
}

function StatusOrb({ overall }: { overall: Status }) {
  const color = overall === "ok" ? "bg-brand" : overall === "warn" ? "bg-amber" : "bg-alert";
  const Icon = overall === "ok" ? CircleCheck : overall === "warn" ? TriangleAlert : CircleAlert;
  return (
    <div className="relative flex size-16 shrink-0 items-center justify-center">
      <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-20 motion-reduce:hidden", color)} />
      <span className={cn("absolute inline-flex size-full rounded-full opacity-10", color)} />
      <span className={cn("relative flex size-12 items-center justify-center rounded-full text-white", color)}>
        <Icon className="size-6" />
      </span>
    </div>
  );
}

function HealthRing({ pct, status }: { pct: number; status: Status }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const stroke = status === "ok" ? "var(--brand)" : status === "warn" ? "#d9a441" : "#e2483d";
  return (
    <div className="relative hidden size-24 shrink-0 sm:block">
      <svg viewBox="0 0 72 72" className="size-full -rotate-90">
        <circle cx="36" cy="36" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-ink-3/25" />
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          style={{ transition: "stroke-dashoffset 700ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-xl font-semibold tabular-nums text-ink">{pct}%</span>
        <span className="text-[10px] uppercase tracking-wider text-ink-3">healthy</span>
      </div>
    </div>
  );
}

// ── KPI tile ───────────────────────────────────────────────────────────

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  sub: string;
  tone?: "warn" | "alert";
}) {
  const tint = tone === "warn" ? "text-amber" : tone === "alert" ? "text-alert" : "text-ink-3";
  return (
    <div className="rounded-2xl border border-border bg-paper-raised/50 p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">{label}</p>
        <Icon className={cn("size-4", tint)} />
      </div>
      <p className="mt-2 font-display text-3xl font-semibold tabular-nums tracking-tight text-ink">
        {value.toLocaleString()}
      </p>
      <p className={cn("mt-0.5 text-xs", tone ? tint : "text-ink-3")}>{sub}</p>
    </div>
  );
}

// ── Outbound-traffic strip (compact 24h hourly bars) ───────────────────

function TrafficStrip({ series, total24h, failed24h }: { series: HttpPoint[]; total24h: number; failed24h: number }) {
  const max = Math.max(1, ...series.map((p) => p.total));
  const peak = Math.max(0, ...series.map((p) => p.total));
  return (
    <div className="rounded-2xl border border-border bg-paper-raised/50 px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">Outbound traffic · 24h</p>
        <p className="text-xs text-ink-2">
          <span className="font-semibold text-ink">{total24h}</span> request{total24h === 1 ? "" : "s"}
          {failed24h > 0 ? (
            <span className="text-alert"> · {failed24h} failed</span>
          ) : (
            <span className="text-ink-3"> · none failed</span>
          )}
          {peak > 0 && <span className="text-ink-3"> · peak {peak}/hr</span>}
        </p>
      </div>

      <div className="mt-3 flex h-10 items-end gap-[2px]">
        {series.map((p, i) => {
          const filled = p.total > 0;
          const h = filled ? Math.max(4, Math.round((p.total / max) * 34) + 3) : 3;
          return (
            <div
              key={i}
              title={`${hourLabel(p.hour)} · ${p.total} request${p.total === 1 ? "" : "s"}${p.failed ? ` (${p.failed} failed)` : ""}`}
              className={cn(
                "flex-1 rounded-t transition-[height] duration-500",
                p.failed > 0 ? "bg-alert" : filled ? "bg-brand" : "bg-ink-3/15",
              )}
              style={{ height: h }}
            />
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] uppercase tracking-wider text-ink-3">
        <span>24h ago</span>
        <span>now</span>
      </div>
    </div>
  );
}

function hourLabel(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, "0")}:00`;
}

// ── Checks panel ───────────────────────────────────────────────────────

const CHECK_ICON: Record<string, LucideIcon> = {
  vault_config: KeyRound,
  outbound_http: Radio,
  crash_volume: Bug,
  photos_processing: ImageIcon,
  stuck_broadcasts: Send,
  backup_recent: DatabaseBackup,
};

function ChecksPanel({ checks }: { checks: Check[] }) {
  return (
    <div className="rounded-2xl border border-border bg-paper-raised/50 p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">Checks</p>
      <div className="mt-3 space-y-2">
        {checks.map((c) => {
          const Icon = CHECK_ICON[c.id] ?? Activity;
          return (
            <div
              key={c.id}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3 py-2.5",
                c.status === "fail"
                  ? "border-alert/25 bg-alert/[0.05]"
                  : c.status === "warn"
                    ? "border-amber/25 bg-amber/[0.05]"
                    : "border-rule/50 bg-paper-sunken/20",
              )}
            >
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg",
                  c.status === "ok" ? "bg-brand/10 text-brand" : c.status === "warn" ? "bg-amber/10 text-amber" : "bg-alert/10 text-alert",
                )}
              >
                <Icon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{c.label}</p>
                <p className="truncate text-xs text-ink-3">{c.detail}</p>
              </div>
              <StatusPip status={c.status} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Jobs panel ─────────────────────────────────────────────────────────

function JobsPanel({ jobs, now }: { jobs: Job[]; now: number }) {
  return (
    <div className="rounded-2xl border border-border bg-paper-raised/50 p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">Scheduled jobs</p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {jobs.map((j) => (
          <div
            key={j.jobname}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-3 py-2.5",
              j.status === "fail"
                ? "border-alert/25 bg-alert/[0.05]"
                : j.status === "warn"
                  ? "border-amber/25 bg-amber/[0.05]"
                  : "border-rule/50 bg-paper-sunken/20",
            )}
          >
            <Clock className="size-4 shrink-0 text-ink-3" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{humanJob(j.jobname)}</p>
              <p className="truncate text-xs text-ink-3">
                {cadence(j.schedule)} · ran {ago(j.last_start, now)}
                {j.last_status === "failed" && <span className="text-alert"> · failed</span>}
              </p>
            </div>
            <StatusPip status={j.status} />
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusPip({ status }: { status: Status }) {
  const label = status === "ok" ? "OK" : status === "warn" ? "Warn" : "Down";
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        status === "ok" ? "bg-brand/10 text-brand" : status === "warn" ? "bg-amber/10 text-amber" : "bg-alert/10 text-alert",
      )}
    >
      {label}
    </span>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────

function ago(iso: string | null, now: number): string {
  if (!iso) return "never";
  const secs = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (secs < 15) return "just now";
  if (secs < 90) return `${secs}s ago`;
  const m = Math.round(secs / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function cadence(schedule: string): string {
  const p = schedule.trim().split(/\s+/);
  if (p.length < 5) return schedule;
  if (p[4] !== "*") return "Weekly";
  if (p[1] === "*") return p[0].startsWith("*/") || p[0] === "*" ? "Every minute" : "Hourly";
  if (p[2] !== "*" || p[3] !== "*") return "Monthly";
  return `Daily ${p[1].padStart(2, "0")}:${p[0].padStart(2, "0")}`;
}

function humanJob(name: string): string {
  const map: Record<string, string> = {
    vestige_broadcast_delivery: "Broadcast delivery",
    vestige_index_recompute: "Vestige Index recompute",
    vestige_leaderboard_snapshot: "Leaderboard snapshot",
    vestige_new_course_notifications: "New-course notifications",
    vestige_settle_society_formats: "Society format settlement",
    vestige_ops_health_alerts: "Ops health alerter",
    process_pending_email_campaigns: "Email campaign sender",
    process_pending_broadcasts: "Broadcast scheduler",
  };
  return map[name] ?? name.replace(/^vestige_/, "").replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
