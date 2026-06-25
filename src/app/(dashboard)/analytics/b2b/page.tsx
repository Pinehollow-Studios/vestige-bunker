import { ShieldCheck } from "lucide-react";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { AnalyticsNav } from "@/components/admin/analytics/AnalyticsNav";
import { Reveal } from "@/components/admin/Motion";
import {
  SectionLabel,
  BarList,
  BigStat,
  MetricCard,
  ProportionBar,
  ThresholdNote,
  EmptyHint,
} from "@/components/admin/analytics/viz";
import { tryCreateServiceClient } from "@/lib/supabase/admin";
import { MIN_COHORT_N } from "@/lib/analytics/config";
import { CatchmentMap } from "@/components/admin/analytics/CatchmentMap";
import {
  getB2BVolume,
  getB2BCatchment,
  getB2BIntent,
  getB2BConversion,
  getB2BVisitorProfile,
  getCountyShapes,
  type B2BVisitorProfileRow,
} from "@/lib/analytics/queries";

export const dynamic = "force-dynamic";

/** Readable labels for the demographic band wire values. */
const BAND_LABEL: Record<string, string> = {
  // age bands
  "17_24": "17–24",
  "25_34": "25–34",
  "35_44": "35–44",
  "45_54": "45–54",
  "55_64": "55–64",
  "65_plus": "65+",
  // handicap bands
  scratch_or_better: "Scratch+",
  "1_5": "1–5",
  "6_12": "6–12",
  "13_20": "13–20",
  "21_28": "21–28",
  "29_plus": "29+",
  no_handicap: "No handicap",
  // player type
  member: "Member",
  society: "Society",
  visitor: "Visitor",
  // shared
  prefer_not: "Prefer not to say",
};

const DIMENSION_LABEL: Record<string, string> = {
  age_band: "Age",
  handicap_band: "Handicap",
  player_type: "Player type",
};

const DIMENSION_ORDER = ["age_band", "handicap_band", "player_type"] as const;

function bandLabel(band: string): string {
  return BAND_LABEL[band] ?? band.replace(/_/g, " ");
}

export default async function B2BPreviewPage() {
  const supabase = await tryCreateServiceClient();
  if (!supabase) return <Shell>{notConfigured}</Shell>;

  const [volume, catchment, intent, conversion, profile, countyShapes] = await Promise.all([
    getB2BVolume(supabase),
    getB2BCatchment(supabase),
    getB2BIntent(supabase),
    getB2BConversion(supabase),
    getB2BVisitorProfile(supabase),
    getCountyShapes(supabase),
  ]);

  const catchmentValues: Record<string, number> = {};
  for (const r of catchment) catchmentValues[r.county_id] = r.players;

  const volumeItems = volume.map((r) => ({
    key: r.club_id,
    label: r.club_name,
    value: r.plays,
    trailing: `${r.players.toLocaleString()} players`,
  }));
  const catchmentItems = catchment.map((r) => ({
    key: r.county_id,
    label: r.county_name,
    value: r.players,
  }));
  const intentItems = intent.map((r) => ({
    key: r.club_id,
    label: r.club_name,
    value: r.intenders,
  }));

  const conversionPct = conversion && conversion.intended > 0 ? Math.round(conversion.rate * 100) : null;

  // Group the visitor profile by dimension, in a stable order.
  const byDimension = new Map<string, B2BVisitorProfileRow[]>();
  for (const r of profile) {
    if (!byDimension.has(r.dimension)) byDimension.set(r.dimension, []);
    byDimension.get(r.dimension)!.push(r);
  }

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

      {/* ── Conversion hero ── */}
      <Reveal>
        <section className="rounded-2xl glass-panel p-5">
          <SectionLabel>Conversion · want-to-play → played</SectionLabel>
          <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-[220px_1fr] sm:items-center">
            <BigStat
              label="Conversion rate"
              value={conversionPct === null ? "—" : `${conversionPct}%`}
              sub={
                conversion && conversion.intended > 0
                  ? `${conversion.converted.toLocaleString()} of ${conversion.intended.toLocaleString()} want-to-play became played`
                  : "Not enough intent signal yet"
              }
            />
            <div className="grid grid-cols-3 gap-3">
              <MetricCard
                label="Intended"
                value={(conversion?.intended ?? 0).toLocaleString()}
                hint="Want-to-play"
              />
              <MetricCard
                label="Converted"
                value={(conversion?.converted ?? 0).toLocaleString()}
                hint="Became a play"
              />
              <MetricCard
                label="Users"
                value={(conversion?.users ?? 0).toLocaleString()}
                hint="Opt-out excluded"
              />
            </div>
          </div>
          <div className="mt-4">
            <ThresholdNote n={MIN_COHORT_N} />
          </div>
        </section>
      </Reveal>

      {/* ── Volume + intent by club ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Reveal delay={60}>
          <section className="space-y-3 rounded-xl glass-panel p-4">
            <SectionLabel>Volume by club</SectionLabel>
            <p className="text-[11px] text-ink-3">Plays per club, with distinct players alongside.</p>
            <BarList items={volumeItems} tone="brand" emptyLabel="No club passes the cohort threshold yet." />
            <ThresholdNote n={MIN_COHORT_N} />
          </section>
        </Reveal>

        <Reveal delay={80}>
          <section className="space-y-3 rounded-xl glass-panel p-4">
            <SectionLabel>Intent · want-to-play by club</SectionLabel>
            <p className="text-[11px] text-ink-3">Distinct users with the club on a list — the demand signal.</p>
            <BarList items={intentItems} tone="amber" emptyLabel="No club passes the cohort threshold yet." />
            <ThresholdNote n={MIN_COHORT_N} />
          </section>
        </Reveal>
      </div>

      {/* ── Catchment ── */}
      <Reveal delay={100}>
        <section className="space-y-3 rounded-xl glass-panel p-4">
          <SectionLabel>Catchment · visitor home counties</SectionLabel>
          <p className="text-[11px] text-ink-3">
            Where players come from. County-level only — no finer location is collected.
          </p>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_280px] lg:items-start">
            <CatchmentMap shapes={countyShapes} values={catchmentValues} />
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">Ranked</p>
              <BarList items={catchmentItems} tone="info" emptyLabel="No county passes the cohort threshold yet." />
            </div>
          </div>
          <ThresholdNote n={MIN_COHORT_N} />
        </section>
      </Reveal>

      {/* ── Visitor profile ── */}
      <Reveal delay={120}>
        <section className="space-y-4 rounded-2xl glass-panel p-5">
          <SectionLabel>Visitor profile</SectionLabel>
          <p className="text-[11px] text-ink-3">
            Aggregated demographic mix of contributing players. Bands under {MIN_COHORT_N} users are suppressed.
          </p>
          {profile.length === 0 ? (
            <EmptyHint>No demographic band passes the cohort threshold yet.</EmptyHint>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              {DIMENSION_ORDER.map((dim) => {
                const rows = byDimension.get(dim) ?? [];
                if (rows.length === 0) return null;
                const segments = rows
                  .slice()
                  .sort((a, b) => b.players - a.players)
                  .map((r) => ({ label: bandLabel(r.band), value: r.players }));
                return (
                  <div key={dim} className="space-y-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
                      {DIMENSION_LABEL[dim] ?? dim}
                    </p>
                    <ProportionBar segments={segments} />
                  </div>
                );
              })}
            </div>
          )}
          <ThresholdNote n={MIN_COHORT_N} />
        </section>
      </Reveal>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <SectionHeader eyebrow="Insights · Analytics" title="B2B preview" />
      <AnalyticsNav active="/analytics/b2b" />
      {children}
    </div>
  );
}

const notConfigured = (
  <div className="rounded-xl border border-amber/40 bg-amber/10 p-4 text-sm text-amber">
    Service-role key not configured — set <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> to read the
    analytics views.
  </div>
);
