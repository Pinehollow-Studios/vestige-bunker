import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";
import { pageShell } from "@/components/admin/PageShell";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { tryCreateServiceClient } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";
import { HealthRefresh } from "./HealthRefresh";

export const dynamic = "force-dynamic";

/**
 * Ops health board (Vestige-ios docs/admin-growth-tooling-roadmap.md Phase 1.4).
 * Reads the backend's real health signals — scheduled jobs, outbound HTTP,
 * pipeline secrets, crashes, stuck work, backup heartbeat — via the
 * `admin_ops_checks` / `admin_ops_cron_health` RPCs (service-role client;
 * is_admin short-circuits for it), gated by the layout's requireAdmin().
 */

type Status = "ok" | "warn" | "fail";
type Check = { id: string; label: string; status: Status; detail: string };
type Job = {
  jobname: string;
  schedule: string;
  active: boolean;
  last_status: string | null;
  last_start: string | null;
  status: Status;
};

function worst(...s: Status[]): Status {
  if (s.includes("fail")) return "fail";
  if (s.includes("warn")) return "warn";
  return "ok";
}

const DOT: Record<Status, string> = {
  ok: "bg-brand",
  warn: "bg-amber",
  fail: "bg-alert",
};

function ago(iso: string | null): string {
  if (!iso) return "never";
  const secs = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 90) return "just now";
  const m = Math.round(secs / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export default async function HealthPage() {
  const supabase = await tryCreateServiceClient();

  if (!supabase) {
    return (
      <div className={pageShell("content")}>
        <SectionHeader eyebrow="Operations" title="Health" />
        <div className="rounded-xl border border-amber/40 bg-amber/10 p-4 text-sm text-ink-2">
          Needs the service-role key for the active environment to read the health checks.
        </div>
      </div>
    );
  }

  const [checksRes, jobsRes] = await Promise.all([
    supabase.rpc("admin_ops_checks"),
    supabase.rpc("admin_ops_cron_health"),
  ]);
  const checks = (checksRes.data ?? []) as Check[];
  const jobs = (jobsRes.data ?? []) as Job[];

  const all: Status[] = [...checks.map((c) => c.status), ...jobs.map((j) => j.status)];
  const fails = all.filter((s) => s === "fail").length;
  const warns = all.filter((s) => s === "warn").length;
  const overall = worst(...all);

  const HERO = {
    ok: { icon: CircleCheck, tint: "text-brand", bg: "bg-brand/10", ring: "border-brand/30", title: "All systems healthy", sub: "Every check and scheduled job is green." },
    warn: { icon: TriangleAlert, tint: "text-amber", bg: "bg-amber/10", ring: "border-amber/30", title: `${warns} warning${warns === 1 ? "" : "s"}`, sub: "Worth a look, nothing down." },
    fail: { icon: CircleAlert, tint: "text-alert", bg: "bg-alert/10", ring: "border-alert/30", title: `${fails} issue${fails === 1 ? "" : "s"} need attention`, sub: "Something's broken — see the red rows below." },
  }[overall];
  const HeroIcon = HERO.icon;

  return (
    <div className={pageShell("content")}>
      <SectionHeader eyebrow="Operations" title="Health" actions={<HealthRefresh />} />

      {/* Overall. */}
      <div className={cn("flex items-center gap-4 rounded-2xl border p-5", HERO.ring, HERO.bg)}>
        <div className={cn("flex size-12 items-center justify-center rounded-xl bg-paper-raised/70", HERO.tint)}>
          <HeroIcon className="size-6" />
        </div>
        <div>
          <p className="font-display text-xl font-semibold tracking-tight text-ink">{HERO.title}</p>
          <p className="text-sm text-ink-3">{HERO.sub}</p>
        </div>
      </div>

      {/* Checks. */}
      <Section title="Checks">
        {checks.map((c) => (
          <Row key={c.id} status={c.status} label={c.label} detail={c.detail} />
        ))}
      </Section>

      {/* Scheduled jobs. */}
      <Section title="Scheduled jobs">
        {jobs.map((j) => (
          <Row
            key={j.jobname}
            status={j.status}
            label={humanJob(j.jobname)}
            detail={
              j.active
                ? `${j.last_status === "failed" ? "Last run failed · " : ""}ran ${ago(j.last_start)} · ${j.schedule}`
                : `Paused · ${j.schedule}`
            }
            mono={j.jobname}
          />
        ))}
      </Section>

      <p className="text-xs text-ink-3">
        Checks re-run each time you open or refresh this page. A 15-minute alerter posts to Slack/Discord
        when something fails — set an <code className="font-mono">ops_alert_webhook</code> vault secret to
        turn it on. The prod-backup row goes green once the backup job pings its heartbeat.
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-3">{title}</h2>
      <div className="divide-y divide-rule/50 overflow-hidden rounded-xl glass-panel">{children}</div>
    </section>
  );
}

function Row({
  status,
  label,
  detail,
  mono,
}: {
  status: Status;
  label: string;
  detail: string;
  mono?: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className={cn("size-2.5 shrink-0 rounded-full", DOT[status])} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="truncate text-xs text-ink-3">{detail}</p>
      </div>
      {mono && <code className="hidden shrink-0 font-mono text-[11px] text-ink-3 sm:block">{mono}</code>}
    </div>
  );
}

/** cron job name → friendly label. */
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
