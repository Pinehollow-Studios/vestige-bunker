import { pageShell } from "@/components/admin/PageShell";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight, Flag, Mail, MessageSquareWarning } from "lucide-react";
import { activeStorageBaseUrl, createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { isUuid } from "@/lib/security/postgrest";
import { avatarURL } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { kindLabel, workStageLabel, type FeedbackKind, type FeedbackWorkStage } from "@/lib/feedback/types";
import { UserActions } from "./UserActions";

export const dynamic = "force-dynamic";

type AccountStatus = "active" | "restricted" | "suspended";
type Privacy = "onlyMe" | "friendsOnly" | "everyone";

type UserRow = {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  avatar_photo_id: string | null;
  privacy: Privacy;
  account_status: AccountStatus;
  is_admin_hidden_from_public_leaderboards: boolean;
  admin_hidden_at: string | null;
  is_founding_member: boolean;
  analytics_opt_out: boolean;
  home_club_id: string | null;
  home_county_id: string | null;
  last_seen_app_version: string | null;
  created_at: string;
  updated_at: string | null;
};

const USER_COLUMNS =
  "id, username, display_name, bio, avatar_photo_id, privacy, account_status, " +
  "is_admin_hidden_from_public_leaderboards, admin_hidden_at, is_founding_member, " +
  "analytics_opt_out, home_club_id, home_county_id, last_seen_app_version, created_at, updated_at";

type ReportRow = { id: string; kind: FeedbackKind; work_stage: FeedbackWorkStage; body: string; created_at: string };
type FlagRow = { id: string; flag_kind: string; state: string; triggered_at: string };
type RoundRow = { course_id: string; date: string; gross_score: number | null };
type EmailHistRow = {
  campaign_id: string;
  name: string;
  subject: string;
  sent_at: string | null;
  recipient_status: string;
  delivered_at: string | null;
  opened_at: string | null;
  open_count: number;
  clicked_at: string | null;
  click_count: number;
  bounced_at: string | null;
  bounce_reason: string | null;
  complained_at: string | null;
};

export default async function UserHubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Reject non-UUID ids up front - they can't match a row and would otherwise
  // be interpolated into a PostgREST `.or()` filter further down.
  if (!isUuid(id)) notFound();
  const admin = await requireAdmin();

  let supabase;
  try {
    supabase = await createServiceClient();
  } catch (e) {
    return (
      <Shell>
        <Err>{e instanceof Error ? e.message : "Service-role client unavailable."}</Err>
      </Shell>
    );
  }

  const { data, error } = await supabase.from("users").select(USER_COLUMNS).eq("id", id).maybeSingle();
  if (error) {
    return (
      <Shell>
        <Err>Failed to load user: {error.message}</Err>
      </Shell>
    );
  }
  if (!data) notFound();
  const user = data as unknown as UserRow;

  const [
    clubRes,
    countyRes,
    roundsCount,
    coursesCount,
    photosCount,
    friendsCount,
    reportsCount,
    flagsCount,
    reportsRes,
    flagsRes,
    roundsRes,
  ] = await Promise.all([
    user.home_club_id
      ? supabase.from("clubs").select("name").eq("id", user.home_club_id).maybeSingle()
      : Promise.resolve({ data: null }),
    user.home_county_id
      ? supabase.from("counties").select("name").eq("id", user.home_county_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("logged_rounds").select("id", { count: "exact", head: true }).eq("user_id", id),
    supabase.from("played_markers").select("id", { count: "exact", head: true }).eq("user_id", id),
    supabase.from("photos").select("id", { count: "exact", head: true }).eq("uploader_user_id", id),
    supabase
      .from("friendships")
      .select("id", { count: "exact", head: true })
      .eq("status", "accepted")
      .or(`requester_id.eq.${id},addressee_id.eq.${id}`),
    supabase.from("feedback_reports").select("id", { count: "exact", head: true }).eq("user_id", id),
    supabase.from("safeguarding_flags").select("id", { count: "exact", head: true }).eq("user_id", id),
    supabase
      .from("feedback_reports")
      .select("id, kind, work_stage, body, created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("safeguarding_flags")
      .select("id, flag_kind, state, triggered_at")
      .eq("user_id", id)
      .order("triggered_at", { ascending: false })
      .limit(6),
    supabase
      .from("logged_rounds")
      .select("course_id, date, gross_score")
      .eq("user_id", id)
      .order("date", { ascending: false })
      .limit(6),
  ]);

  const reports = (reportsRes.data as ReportRow[] | null) ?? [];
  const flags = (flagsRes.data as FlagRow[] | null) ?? [];
  const rounds = (roundsRes.data as RoundRow[] | null) ?? [];

  const courseNames: Record<string, string> = {};
  const courseIds = Array.from(new Set(rounds.map((r) => r.course_id)));
  if (courseIds.length > 0) {
    const { data: cRows } = await supabase.from("courses").select("id,name").in("id", courseIds);
    for (const c of cRows ?? []) courseNames[c.id] = c.name;
  }

  // Email history — the RPC self-gates on is_admin(), so it needs the admin
  // SESSION (the service-role client has no auth.uid()). Degrades to empty.
  const sessionDb = await createClient();
  const emailHistRes = await sessionDb.rpc("admin_user_email_history", { p_user_id: id });
  const emailHistory = (emailHistRes.data as EmailHistRow[] | null) ?? [];

  const clubName = (clubRes.data as { name?: string } | null)?.name ?? null;
  const countyName = (countyRes.data as { name?: string } | null)?.name ?? null;
  const baseUrl = await activeStorageBaseUrl();
  const avatar = avatarURL(user.id, user.avatar_photo_id, baseUrl);
  const name = user.display_name?.trim() || user.username;

  const stats = [
    { label: "Rounds", value: roundsCount.count ?? 0 },
    { label: "Courses", value: coursesCount.count ?? 0 },
    { label: "Photos", value: photosCount.count ?? 0 },
    { label: "Friends", value: friendsCount.count ?? 0 },
    { label: "Reports", value: reportsCount.count ?? 0 },
    { label: "Flags", value: flagsCount.count ?? 0, alert: (flagsCount.count ?? 0) > 0 },
  ];

  return (
    <Shell>
      {/* Identity */}
      <section className="flex items-start gap-4 rounded-xl glass-panel p-5">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" className="size-16 shrink-0 rounded-full bg-paper-sunken object-cover" />
        ) : (
          <div className="grid size-16 shrink-0 place-items-center rounded-full bg-brand/15 text-lg font-semibold text-brand">
            {initials(name)}
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-xl font-semibold text-ink">{name}</h1>
            <span className="text-sm text-ink-3">@{user.username}</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusChip status={user.account_status} />
            {user.is_founding_member && <Pill tone="brand">Founding member</Pill>}
            {user.is_admin_hidden_from_public_leaderboards && <Pill tone="amber">Hidden from boards</Pill>}
            <Pill tone="neutral">{prettyPrivacy(user.privacy)}</Pill>
          </div>
          {user.bio && <p className="text-sm leading-snug text-ink-2">{user.bio}</p>}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Activity */}
        <div className="min-w-0 space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl glass-panel p-3 text-center">
                <p className={cn("font-display text-2xl font-semibold tabular-nums", s.alert ? "text-alert" : "text-ink")}>
                  {s.value.toLocaleString()}
                </p>
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-3">{s.label}</p>
              </div>
            ))}
          </div>

          <Card title={`Feedback reports (${reportsCount.count ?? 0})`}>
            {reports.length === 0 ? (
              <Empty>No reports from this user.</Empty>
            ) : (
              <ul className="divide-y divide-rule/50">
                {reports.map((r) => (
                  <li key={r.id}>
                    <Link href={`/feedback/${r.id}`} className="flex items-center gap-3 py-2.5 transition-colors hover:opacity-80">
                      <MessageSquareWarning aria-hidden className="size-4 shrink-0 text-ink-3" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-ink">{snippet(r.body)}</p>
                        <p className="text-[11px] text-ink-3">
                          {kindLabel(r.kind)} · {workStageLabel(r.work_stage)} · {relativeTime(r.created_at)}
                        </p>
                      </div>
                      <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-3" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {flags.length > 0 && (
            <Card title={`Safeguarding flags (${flagsCount.count ?? 0})`}>
              <ul className="divide-y divide-rule/50">
                {flags.map((f) => (
                  <li key={f.id}>
                    <Link href="/safeguarding" className="flex items-center gap-3 py-2.5 transition-colors hover:opacity-80">
                      <Flag aria-hidden className="size-4 shrink-0 text-amber" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-ink">{prettyFlagKind(f.flag_kind)}</p>
                        <p className="text-[11px] text-ink-3">{f.state.replace(/_/g, " ")} · {relativeTime(f.triggered_at)}</p>
                      </div>
                      <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-3" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title="Recent rounds">
            {rounds.length === 0 ? (
              <Empty>No rounds logged.</Empty>
            ) : (
              <ul className="divide-y divide-rule/50">
                {rounds.map((r, i) => (
                  <li key={i}>
                    <Link
                      href={`/courses/${r.course_id}`}
                      className="flex items-center gap-3 py-2.5 transition-colors hover:opacity-80"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-ink">{courseNames[r.course_id] ?? "Unknown course"}</p>
                        <p className="text-[11px] text-ink-3">{formatDate(r.date)}</p>
                      </div>
                      {r.gross_score != null && (
                        <span className="font-display text-sm font-semibold tabular-nums text-ink-2">{r.gross_score}</span>
                      )}
                      <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-3" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={`Email history (${emailHistory.length})`}>
            {emailHistory.length === 0 ? (
              <Empty>No campaign emails sent to this user.</Empty>
            ) : (
              <ul className="divide-y divide-rule/50">
                {emailHistory.map((e) => (
                  <li key={e.campaign_id}>
                    <Link
                      href={`/emails/campaigns/${e.campaign_id}`}
                      className="flex items-center gap-3 py-2.5 transition-colors hover:opacity-80"
                    >
                      <Mail aria-hidden className="size-4 shrink-0 text-ink-3" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-ink">{e.subject || e.name}</p>
                        <p className="text-[11px] text-ink-3">
                          {e.sent_at ? relativeTime(e.sent_at) : "not sent"}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                        <EmailStatePills e={e} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Actions + account */}
        <div className="space-y-5">
          <UserActions
            userId={user.id}
            status={user.account_status}
            hidden={user.is_admin_hidden_from_public_leaderboards}
            isSuperAdmin={admin.role === "super_admin"}
          />
          <Card title="Account">
            <dl className="space-y-2.5 text-xs">
              <Row label="Home club" value={clubName ?? (user.home_club_id ? "-" : "Not set")} />
              <Row label="Home county" value={countyName ?? (user.home_county_id ? "-" : "Not set")} />
              <Row label="Analytics" value={user.analytics_opt_out ? "Opted out" : "Opted in"} />
              <Row label="Last seen" value={user.last_seen_app_version ?? "-"} />
              <Row label="Joined" value={formatDate(user.created_at)} />
              {user.is_admin_hidden_from_public_leaderboards && (
                <Row label="Hidden at" value={formatDate(user.admin_hidden_at)} />
              )}
              <Row label="User ID" value={user.id} mono />
            </dl>
          </Card>
        </div>
      </div>
    </Shell>
  );
}

// ── chrome ─────────────────────────────────────────────────────────────
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className={pageShell("content")}>
      <Link href="/users" className="inline-flex items-center gap-1.5 text-sm text-ink-2 transition-colors hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" /> All users
      </Link>
      {children}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl glass-panel p-5">
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-ink-3">{label}</dt>
      <dd className={cn("min-w-0 text-right text-ink-2", mono && "break-all font-mono text-[10px]")}>{value}</dd>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-3 text-center text-xs text-ink-3">{children}</p>;
}
function Err({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">{children}</div>;
}

function Pill({ tone, children }: { tone: "brand" | "amber" | "neutral"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        tone === "brand" ? "border-brand/40 text-brand" : tone === "amber" ? "border-amber/40 text-amber" : "border-rule/70 text-ink-3",
      )}
    >
      {children}
    </span>
  );
}

function EmailStatePills({ e }: { e: EmailHistRow }) {
  const pills: React.ReactNode[] = [];
  if (e.recipient_status === "failed") pills.push(<Pill key="f" tone="amber">Failed</Pill>);
  if (e.complained_at) pills.push(<Pill key="c" tone="amber">Spam</Pill>);
  if (e.bounced_at) pills.push(<Pill key="b" tone="amber">Bounced</Pill>);
  if (e.click_count > 0) pills.push(<Pill key="cl" tone="brand">Clicked</Pill>);
  else if (e.open_count > 0) pills.push(<Pill key="o" tone="brand">Opened</Pill>);
  else if (e.delivered_at) pills.push(<Pill key="d" tone="neutral">Delivered</Pill>);
  else if (e.recipient_status === "sent") pills.push(<Pill key="s" tone="neutral">Sent</Pill>);
  return <>{pills}</>;
}

function StatusChip({ status }: { status: AccountStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        status === "active" ? "border-brand/40 text-brand" : status === "restricted" ? "border-amber/40 text-amber" : "border-alert/40 text-alert",
      )}
    >
      {status}
    </span>
  );
}

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return (parts.length >= 2 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
}
function prettyPrivacy(p: Privacy): string {
  return p === "onlyMe" ? "Only me" : p === "friendsOnly" ? "Friends only" : "Public";
}
function prettyFlagKind(k: string): string {
  return k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function snippet(body: string): string {
  const t = body.trim().replace(/\s+/g, " ");
  return t.length <= 80 ? t : t.slice(0, 77) + "…";
}
function formatDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function relativeTime(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d`;
  return `${Math.round(days / 30)}mo`;
}
