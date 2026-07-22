import { pageShell } from "@/components/admin/PageShell";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { StatTile } from "@/components/admin/StatTile";
import { tryCreateServiceClient } from "@/lib/supabase/admin";
import { FoundingPerkCard } from "./FoundingPerkCard";
import { GrantsCard, type GrantRow } from "./GrantsCard";
import { PromoCodesCard, type PromoCodeRow } from "./PromoCodesCard";

export const dynamic = "force-dynamic";

/**
 * Vestige Pro — the membership surface.
 *
 * The one thing to hold onto (Vestige-ios `docs/pro-tier-backend.md`): **the
 * server decides who is Pro, not Apple and not the client.** Two inputs feed
 * that answer — `pro_subscriptions` (the Apple mirror, written by the
 * `appstore-notifications` function) and `pro_grants` (everything else: comps,
 * promos, and the founding windows). This page is where the second one is
 * driven, and where the first one is watched.
 *
 * WIP by design — Pro ships September, and the surfaces grow with it.
 */
export default async function ProPage() {
  const supabase = await tryCreateServiceClient();

  if (!supabase) {
    return (
      <div className={pageShell()}>
        <SectionHeader eyebrow="Operations" title="Vestige Pro" />
        <div className="rounded-xl border border-amber/40 bg-amber/10 p-4 text-sm text-ink-2">
          Needs the service-role key for the active environment to read Pro config and grants.
        </div>
      </div>
    );
  }

  const [overviewRes, configRes, foundersRes, grantsRes, codesRes] = await Promise.all([
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
    // RPC's is_admin() gate).
    supabase.rpc("admin_list_promo_codes", { p_limit: 200, p_offset: 0 }),
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
    kind: string;
    duration_months: number | null;
    label: string | null;
    created_at: string;
    redeemed_at: string | null;
    redeemed_username: string | null;
    revoked_at: string | null;
  };
  const promoCodes: PromoCodeRow[] = ((codesRes.data ?? []) as CodeRpcRow[]).map((c) => ({
    id: c.id,
    code: c.code,
    kind: c.kind,
    durationMonths: c.duration_months,
    label: c.label,
    createdAt: c.created_at,
    redeemedAt: c.redeemed_at,
    redeemedUsername: c.redeemed_username,
    revokedAt: c.revoked_at,
  }));

  const foundingActive = overview?.founding_active ?? 0;
  const armed = config?.founding_pro_enabled ?? false;

  return (
    <div className={pageShell()}>
      <SectionHeader eyebrow="Operations" title="Vestige Pro" />

      {/* Where the tier stands */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Pro members" value={overview?.total_pro ?? 0} tone="brand" />
        <StatTile
          label="Paid"
          value={overview?.via_subscription ?? 0}
          hint="Via the App Store"
        />
        <StatTile label="Granted" value={overview?.via_grant ?? 0} hint="Comps + founding" />
        <StatTile
          label="Founding windows"
          value={foundingActive}
          tone={foundingActive > 0 ? "brand" : "default"}
          hint="Free Pro running"
        />
        <StatTile
          label="Expiring 30d"
          value={overview?.expiring_30d ?? 0}
          tone="amber"
          hint="Grants about to lapse"
        />
        <StatTile
          label="Founding members"
          value={overview?.founding_members ?? founders}
          hint="Eligible for the perk"
        />
      </div>

      {/* Launch state, in one line, because it's the thing that's easy to get wrong */}
      <div
        className={`rounded-xl border p-4 text-sm ${
          armed
            ? "border-brand/40 bg-brand/10 text-ink-2"
            : "border-rule/70 bg-paper-sunken/40 text-ink-2"
        }`}
      >
        {armed ? (
          <>
            <strong className="text-ink">The founding perk is live.</strong> New founding members
            get free Pro automatically.
            {foundingActive === 0 && (
              <> No windows are running yet — use the grant button to start the existing founders.</>
            )}
          </>
        ) : (
          <>
            <strong className="text-ink">Pro is not launched.</strong> The founding perk is off,
            nobody&rsquo;s free window is running, and no clocks have started. Everything below is
            safe to look at.
          </>
        )}
      </div>

      <FoundingPerkCard
        enabled={armed}
        months={config?.beta_free_months ?? 6}
        founders={overview?.founding_members ?? founders}
        granted={foundingActive}
      />

      <PromoCodesCard codes={promoCodes} />

      <GrantsCard grants={grants} />

      <p className="pb-2 text-xs leading-relaxed text-ink-3">
        Paid subscriptions are written by the <code>appstore-notifications</code> function when
        Apple reports a purchase, renewal, refund or lapse — they never need touching here.
        Pricing lives in App Store Connect.
      </p>
    </div>
  );
}
