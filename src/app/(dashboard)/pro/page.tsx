import { pageShell } from "@/components/admin/PageShell";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { StatTile } from "@/components/admin/StatTile";
import { tryCreateServiceClient } from "@/lib/supabase/admin";
import { FoundingPerkCard } from "./FoundingPerkCard";
import { GrantsCard, type GrantRow } from "./GrantsCard";
import { PromoCodesPanel, type PromoBatchRow, type PromoCodeRow } from "./PromoCodesPanel";

export const dynamic = "force-dynamic";

/** How many codes the list pulls before it admits to being a window. */
const CODE_FETCH_CAP = 1000;

/**
 * Vestige Pro — the membership surface.
 *
 * The one thing to hold onto (Vestige-ios `docs/pro-tier-backend.md`): **the
 * server decides who is Pro, not Apple and not the client.** Two inputs feed
 * that answer — `pro_subscriptions` (the Apple mirror, written by the
 * `appstore-notifications` function) and `pro_grants` (everything else: comps,
 * codes, and the founding windows). This page drives the second one.
 *
 * **Ordered by what it's actually for.** Pro isn't on sale, so handing out codes
 * is the only job this page does day to day — it leads, full width, in plain
 * words. Giving one person Pro directly and the early-member perk are real but
 * rare, so they sit below under a quieter heading. The numbers go last: they're
 * a glance, not a task. (Tabs were tried here on 2026-07-23 and taken out same
 * day — they hid the one thing the page is for behind a click.)
 */
export default async function ProPage() {
  const supabase = await tryCreateServiceClient();

  if (!supabase) {
    return (
      <div className={pageShell("wide")}>
        <SectionHeader eyebrow="Operations" title="Vestige Pro" />
        <div className="rounded-xl border border-amber/40 bg-amber/10 p-4 text-sm text-ink-2">
          Needs the service-role key for the active environment to read Pro config and grants.
        </div>
      </div>
    );
  }

  const [overviewRes, configRes, foundersRes, grantsRes, codesRes, batchesRes] = await Promise.all([
    supabase.rpc("admin_pro_overview"),
    supabase
      .from("pro_config")
      .select("founding_pro_enabled, beta_free_months")
      .eq("id", 1)
      .maybeSingle(),
    supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("is_founding_member", true),
    supabase
      .from("pro_grants")
      .select("id, user_id, kind, expires_at, reason, revoked_at, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    // Codes + redeemer usernames in one round-trip (service_role passes the
    // RPC's is_admin() gate). Search + grouping happen client-side over this
    // window — instant, and a beta's code table fits inside it many times over.
    supabase.rpc("admin_list_promo_codes", {
      p_status: null,
      p_search: null,
      p_batch: null,
      p_limit: CODE_FETCH_CAP,
      p_offset: 0,
    }),
    supabase.rpc("admin_list_promo_batches", { p_limit: 200, p_offset: 0 }),
  ]);

  // `admin_pro_overview` returns a single-row table.
  const overview = Array.isArray(overviewRes.data) ? overviewRes.data[0] : overviewRes.data;
  const config = configRes.data;
  const founders = foundersRes.count ?? 0;

  // Resolve usernames for the grants in one round-trip rather than per row.
  const rawGrants = grantsRes.data ?? [];
  const userIds = [...new Set(rawGrants.map((g) => g.user_id))];
  const { data: users } = userIds.length
    ? await supabase.from("users").select("id, username").in("id", userIds)
    : { data: [] as { id: string; username: string }[] };
  const nameFor = new Map((users ?? []).map((u) => [u.id, u.username]));

  const grants: GrantRow[] = rawGrants.map((g) => ({
    id: g.id,
    username: nameFor.get(g.user_id) ?? null,
    kind: g.kind,
    expiresAt: g.expires_at,
    reason: g.reason,
    revokedAt: g.revoked_at,
    createdAt: g.created_at,
  }));

  type CodeRpcRow = {
    id: string;
    code: string;
    duration_months: number | null;
    label: string | null;
    batch_id: string | null;
    created_at: string;
    redeemed_at: string | null;
    redeemed_username: string | null;
    revoked_at: string | null;
  };
  const promoCodes: PromoCodeRow[] = ((codesRes.data ?? []) as CodeRpcRow[]).map((c) => ({
    id: c.id,
    code: c.code,
    durationMonths: c.duration_months,
    label: c.label,
    batchId: c.batch_id,
    createdAt: c.created_at,
    redeemedAt: c.redeemed_at,
    redeemedUsername: c.redeemed_username,
    revokedAt: c.revoked_at,
  }));

  type BatchRpcRow = {
    batch_id: string | null;
    label: string | null;
    duration_months: number | null;
    created_at: string;
    total: number;
    redeemed: number;
    voided: number;
    unused: number;
  };
  const promoBatches: PromoBatchRow[] = ((batchesRes.data ?? []) as BatchRpcRow[]).map((b) => ({
    batchId: b.batch_id,
    label: b.label,
    durationMonths: b.duration_months,
    createdAt: b.created_at,
    total: b.total,
    redeemed: b.redeemed,
    voided: b.voided,
    unused: b.unused,
  }));

  const foundingActive = overview?.founding_active ?? 0;
  const armed = config?.founding_pro_enabled ?? false;
  const codesWaiting = promoCodes.filter((c) => !c.redeemedAt && !c.revokedAt).length;

  return (
    <div className={pageShell("wide")}>
      <SectionHeader eyebrow="Operations" title="Vestige Pro" />

      {/* Where things stand, said once, in words rather than jargon. */}
      <div
        className={`rounded-xl border p-4 text-sm leading-relaxed ${
          armed
            ? "border-brand/40 bg-brand/10 text-ink-2"
            : "border-rule/70 bg-paper-sunken/40 text-ink-2"
        }`}
      >
        {armed ? (
          <>
            <strong className="text-ink">Early members are getting free Pro.</strong> Anyone who
            joins now as a founding member gets it automatically.
            {foundingActive === 0 && (
              <>
                {" "}
                Nobody&rsquo;s free time has started yet — use the button under &ldquo;Free Pro for
                early members&rdquo; below to start the ones who have already joined.
              </>
            )}
          </>
        ) : (
          <>
            <strong className="text-ink">Pro isn&rsquo;t on sale yet.</strong> Nobody can buy it in
            the app, and early members aren&rsquo;t getting their free months yet. Codes do work —
            anyone who uses one gets Pro straight away.
          </>
        )}
      </div>

      {/* The job this page is actually for. */}
      <PromoCodesPanel
        codes={promoCodes}
        batches={promoBatches}
        truncated={promoCodes.length >= CODE_FETCH_CAP}
      />

      {/* Real, but rare. */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center gap-3">
          <h2 className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
            Other ways to give someone Pro
          </h2>
          <span className="h-px flex-1 bg-rule/60" />
        </div>
        <GrantsCard grants={grants} />
        <FoundingPerkCard
          enabled={armed}
          months={config?.beta_free_months ?? 6}
          founders={overview?.founding_members ?? founders}
          granted={foundingActive}
        />
      </div>

      {/* A glance, not a task — so it goes last. */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center gap-3">
          <h2 className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
            How Pro stands
          </h2>
          <span className="h-px flex-1 bg-rule/60" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile label="People with Pro" value={overview?.total_pro ?? 0} tone="brand" />
          <StatTile
            label="Bought it"
            value={overview?.via_subscription ?? 0}
            hint="Paid in the App Store"
          />
          <StatTile
            label="Given it"
            value={overview?.via_grant ?? 0}
            hint="Codes, gifts, early members"
          />
          <StatTile
            label="Free time running"
            value={foundingActive}
            tone={foundingActive > 0 ? "brand" : "default"}
            hint="Early members mid-window"
          />
          <StatTile
            label="Ending in 30 days"
            value={overview?.expiring_30d ?? 0}
            tone="amber"
            hint="Free time about to run out"
          />
          <StatTile label="Codes waiting" value={codesWaiting} hint="Made, not used yet" />
        </div>
        <p className="pb-2 text-xs leading-relaxed text-ink-3">
          Purchases look after themselves: Apple tells us when someone buys, renews, refunds or
          lapses, and the <code>appstore-notifications</code> function writes it down. Prices are
          set in App Store Connect, not here.
        </p>
      </div>
    </div>
  );
}
