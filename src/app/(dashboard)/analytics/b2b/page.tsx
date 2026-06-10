import { ShieldCheck } from "lucide-react";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { AnalyticsNav } from "@/components/admin/analytics/AnalyticsNav";
import { SectionLabel, BarList, BigStat, MetricCard, ProportionBar, ThresholdNote } from "@/components/admin/analytics/viz";
import { tryCreateServiceClient } from "@/lib/supabase/admin";
import { MIN_COHORT_N } from "@/lib/analytics/config";
import { getB2BVolumeByClub, getB2BCatchment, getB2BConversion } from "@/lib/analytics/queries";

export const dynamic = "force-dynamic";

export default async function B2BPreviewPage() {
  const supabase = await tryCreateServiceClient();
  if (!supabase) return <Shell>{notConfigured}</Shell>;

  const [volume, catchment, conversion] = await Promise.all([
    getB2BVolumeByClub(supabase),
    getB2BCatchment(supabase),
    getB2BConversion(supabase),
  ]);

  const volumeItems = volume.rows.map((r) => ({ key: r.key, label: r.label, value: r.plays, trailing: `${r.users} users` }));
  const catchmentSegments = catchment.rows.slice(0, 6).map((r) => ({ label: r.label, value: r.users }));

  return (
    <Shell>
      <div className="flex items-start gap-3 rounded-xl border border-brand/30 bg-brand/[0.06] p-4">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand">
          <ShieldCheck className="size-4" />
        </span>
        <p className="text-[12px] leading-relaxed text-ink-2">
          <span className="font-semibold text-ink">Internal preview — not a club export.</span> Every figure is
          aggregated, excludes opted-out users, and suppresses any cell under {MIN_COHORT_N} users — so this is exactly
          what a club would see. External delivery is Phase 4, legal-gated.
        </p>
      </div>

      <section className="rounded-2xl glass-panel p-5">
        <SectionLabel>Conversion · bucket → played</SectionLabel>
        <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-[200px_1fr] sm:items-center">
          <BigStat
            label="Conversion rate"
            value={`${Math.round(conversion.rate * 100)}%`}
            sub="Bucket-listed courses that became a played marker"
          />
          <div className="grid grid-cols-3 gap-3">
            <MetricCard label="Bucket-listed" value={conversion.bucketed.toLocaleString()} hint="Intent" />
            <MetricCard label="Converted" value={conversion.converted.toLocaleString()} hint="Became a play" />
            <MetricCard label="Users" value={conversion.users.toLocaleString()} hint="Opt-out excluded" />
          </div>
        </div>
        <div className="mt-4">
          <ThresholdNote n={MIN_COHORT_N} />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="space-y-3 rounded-xl glass-panel p-4">
          <SectionLabel>Volume by club</SectionLabel>
          <p className="text-[11px] text-ink-3">Plays per club, with distinct players alongside.</p>
          <BarList items={volumeItems} emptyLabel="No club passes the cohort threshold yet." />
          <ThresholdNote n={MIN_COHORT_N} suppressed={volume.suppressed} />
        </section>

        <section className="space-y-3 rounded-xl glass-panel p-4">
          <SectionLabel>Catchment · visitor home counties</SectionLabel>
          <p className="text-[11px] text-ink-3">Where players come from. County-level only — no finer location is collected.</p>
          <ProportionBar segments={catchmentSegments} />
          <ThresholdNote n={MIN_COHORT_N} suppressed={catchment.suppressed} />
        </section>
      </div>

      <section className="space-y-2 rounded-xl border border-dashed border-rule/70 bg-paper-sunken/40 p-4">
        <SectionLabel>Coming with the data</SectionLabel>
        <p className="text-[12px] leading-relaxed text-ink-2">
          Benchmarks (a club vs similar clubs by tier/region) and the demographic visitor profile (age / handicap /
          membership bands) land once Phase 2 adds the demographic capture. The aggregation here moves to versioned{" "}
          <code className="font-mono">b2b_*</code> SQL views before any external export ships.
        </p>
      </section>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <SectionHeader
        eyebrow="Insights · Analytics"
        title="B2B preview"
        description="The club-data product, as the club would see it — threshold-gated, opt-out-excluded."
      />
      <AnalyticsNav active="/analytics/b2b" />
      {children}
    </div>
  );
}

const notConfigured = (
  <div className="rounded-xl border border-amber/40 bg-amber/10 p-4 text-sm text-amber">
    Service-role key not configured — set <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> to read the
    analytics tables.
  </div>
);
