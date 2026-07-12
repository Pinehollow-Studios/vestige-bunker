import { pageShell } from "@/components/admin/PageShell";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { tryCreateServiceClient } from "@/lib/supabase/admin";
import { HealthDashboard, type Check, type HttpPoint, type Job, type Metrics } from "./HealthDashboard";

export const dynamic = "force-dynamic";

/**
 * Ops health dashboard (Vestige-ios docs/admin-growth-tooling-roadmap.md Phase
 * 1.4). The team's at-a-glance status surface: overall system status, live KPIs,
 * a 14-day activity trend, per-check status, and scheduled-job health — all from
 * the backend's real signals via the admin_ops_* RPCs (service-role client;
 * is_admin short-circuits for it), gated by the layout's requireAdmin().
 */
export default async function HealthPage() {
  const supabase = await tryCreateServiceClient();

  if (!supabase) {
    return (
      <div className={pageShell("wide")}>
        <SectionHeader eyebrow="Operations" title="Health" />
        <div className="rounded-xl border border-amber/40 bg-amber/10 p-4 text-sm text-ink-2">
          Needs the service-role key for the active environment to read the health checks.
        </div>
      </div>
    );
  }

  const [checksRes, jobsRes, metricsRes, httpRes] = await Promise.all([
    supabase.rpc("admin_ops_checks"),
    supabase.rpc("admin_ops_cron_health"),
    supabase.rpc("admin_ops_metrics"),
    supabase.rpc("admin_ops_http_series"),
  ]);

  return (
    <div className={pageShell("wide")}>
      <HealthDashboard
        checks={(checksRes.data ?? []) as Check[]}
        jobs={(jobsRes.data ?? []) as Job[]}
        metrics={((metricsRes.data ?? [])[0] ?? null) as Metrics | null}
        httpSeries={(httpRes.data ?? []) as HttpPoint[]}
        generatedAt={new Date().toISOString()}
      />
    </div>
  );
}
