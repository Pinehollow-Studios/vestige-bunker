import Link from "next/link";
import { Search, Users as UsersIcon } from "lucide-react";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type AccountStatus = "active" | "restricted" | "suspended";
type Privacy = "onlyMe" | "friendsOnly" | "everyone";

type Row = {
  id: string;
  username: string;
  display_name: string;
  privacy: Privacy;
  account_status: AccountStatus;
  is_admin_hidden_from_public_leaderboards: boolean;
  is_founding_member: boolean;
  created_at: string;
  home_club_id: string | null;
};

const PAGE_SIZE = 50;

/**
 * User directory — read-only v1.
 *
 * Surfaces the `users` table so devs can spot-check moderation
 * state (account_status + is_admin_hidden) and find users by
 * username/display name. Set-status / hide / outreach actions
 * land with the per-user detail page in the next slice (RPCs
 * already exist: admin_set_account_status,
 * admin_hide_user_from_public_leaderboards,
 * admin_unhide_user_from_public_leaderboards,
 * admin_message_user_about_safeguarding).
 */
export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: AccountStatus }>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const status = params.status;

  const supabase = await createClient();

  let query = supabase
    .from("users")
    .select(
      "id, username, display_name, privacy, account_status, is_admin_hidden_from_public_leaderboards, is_founding_member, created_at, home_club_id",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (q.length > 0) {
    // citext + ilike — usernames are case-insensitive.
    query = query.or(`username.ilike.%${q}%,display_name.ilike.%${q}%`);
  }
  if (status) {
    query = query.eq("account_status", status);
  }

  const [usersRes, totalRes, restrictedRes, suspendedRes, hiddenRes, foundingRes] = await Promise.all([
    query,
    supabase.from("users").select("id", { count: "exact", head: true }),
    supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("account_status", "restricted"),
    supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("account_status", "suspended"),
    supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("is_admin_hidden_from_public_leaderboards", true),
    supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("is_founding_member", true),
  ]);

  const rows: Row[] = (usersRes.data as Row[] | null) ?? [];
  const totalCount = totalRes.count ?? 0;
  const restrictedCount = restrictedRes.count ?? 0;
  const suspendedCount = suspendedRes.count ?? 0;
  const hiddenCount = hiddenRes.count ?? 0;
  const foundingCount = foundingRes.count ?? 0;

  const filtering = q.length > 0 || Boolean(status);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <SectionHeader
        eyebrow="People &amp; safety · Users"
        title="Users"
        description="Directory of every registered profile — per-user controls land in the detail slice."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatTile label="Total" value={totalCount} />
        <StatTile label="Founding" value={foundingCount} tone="brand" />
        <StatTile label="Restricted" value={restrictedCount} tone="amber" />
        <StatTile label="Suspended" value={suspendedCount} tone="alert" />
        <StatTile label="Hidden" value={hiddenCount} tone="amber" />
      </div>

      <form
        action="/users"
        className="flex flex-wrap items-center gap-2 rounded-xl border border-rule/70 bg-paper-raised/50 p-3"
      >
        <label className="flex flex-1 items-center gap-2 rounded-lg border border-rule/70 bg-paper-sunken/60 px-3 py-2 focus-within:border-brand/40">
          <Search className="size-4 text-ink-3" aria-hidden />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search username or display name…"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-ink-3/70 focus:outline-none"
          />
        </label>
        <select
          name="status"
          defaultValue={status ?? ""}
          className="rounded-lg border border-rule/70 bg-paper-sunken/60 px-3 py-2 text-xs text-ink-2 focus:border-brand/40 focus:outline-none"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="restricted">Restricted</option>
          <option value="suspended">Suspended</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-brand-fg hover:bg-brand-deep"
        >
          Search
        </button>
        {filtering && (
          <Link
            href="/users"
            className="rounded-lg border border-rule/70 px-3 py-2 text-xs text-ink-2 hover:bg-paper-raised/40"
          >
            Clear
          </Link>
        )}
      </form>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-2">
              {filtering ? "Results" : "Recently joined"}
            </h2>
            <span className="text-[11px] tabular-nums text-ink-3">
              {usersRes.count !== null && usersRes.count !== undefined
                ? `${rows.length} of ${usersRes.count}`
                : rows.length}
            </span>
          </div>
          <p className="text-xs text-ink-3">Read-only — controls ship next.</p>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title={filtering ? "No matches" : "No users yet"}
            subtitle={
              filtering
                ? "No users match that filter."
                : "No users have registered yet."
            }
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-rule/70 bg-paper-raised/50">
            <table className="w-full text-sm">
              <thead className="border-b border-rule/60 text-left text-[10px] uppercase tracking-wider text-ink-3">
                <tr>
                  <th className="px-4 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 font-semibold">Privacy</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Flags</th>
                  <th className="px-4 py-3 text-right font-semibold">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule/60">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-paper-raised/40">
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-ink">{row.display_name}</span>
                        <span className="text-xs text-ink-3">@{row.username}</span>
                        {row.is_founding_member && (
                          <span className="rounded-full border border-brand/40 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-brand">
                            FM
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-2">{prettyPrivacy(row.privacy)}</td>
                    <td className="px-4 py-3">
                      <StatusChip status={row.account_status} />
                    </td>
                    <td className="px-4 py-3">
                      {row.is_admin_hidden_from_public_leaderboards ? (
                        <span className="inline-flex rounded-full border border-amber/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber">
                          Hidden
                        </span>
                      ) : (
                        <span className="text-ink-3">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink-3">
                      {relativeTime(row.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {usersRes.error && (
        <div className="rounded-xl border border-alert/40 bg-alert/10 p-4 text-xs text-alert">
          Failed to load users: {usersRes.error.message}.
        </div>
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "brand" | "amber" | "alert";
}) {
  const numClass =
    tone === "brand" && value > 0
      ? "text-brand"
      : tone === "amber" && value > 0
        ? "text-amber"
        : tone === "alert" && value > 0
          ? "text-alert"
          : "text-ink";
  return (
    <div className="rounded-xl border border-rule/70 bg-paper-raised/50 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
        {label}
      </p>
      <p className={"mt-2 font-hero text-3xl leading-none tabular-nums " + numClass}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function StatusChip({ status }: { status: AccountStatus }) {
  const cls =
    status === "active"
      ? "border-brand/40 text-brand"
      : status === "restricted"
        ? "border-amber/40 text-amber"
        : "border-alert/40 text-alert";
  return (
    <span
      className={
        "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider " +
        cls
      }
    >
      {status}
    </span>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-rule/70 bg-paper-raised/50 px-4 py-12 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-brand/15 text-brand">
        <UsersIcon className="size-5" aria-hidden />
      </span>
      <p className="display-serif text-lg text-ink">{title}</p>
      <p className="text-sm text-ink-2">{subtitle}</p>
    </div>
  );
}

function prettyPrivacy(p: Privacy): string {
  switch (p) {
    case "onlyMe":
      return "Only me";
    case "friendsOnly":
      return "Friends only";
    case "everyone":
      return "Everyone";
  }
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMins = Math.round(diffMs / 60_000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.round(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d`;
  return `${Math.round(diffDays / 30)}mo`;
}
