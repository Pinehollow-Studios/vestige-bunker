import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { activeStorageBaseUrl, createServiceClient } from "@/lib/supabase/admin";
import { avatarURL } from "@/lib/storage";

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
  distance_units: string | null;
  default_round_privacy: string | null;
  shake_to_feedback_enabled: boolean | null;
  onboarding_walkthrough_completed_at: string | null;
  username_changed_at: string | null;
  last_seen_app_version: string | null;
  created_at: string;
  updated_at: string | null;
};

const USER_COLUMNS =
  "id, username, display_name, bio, avatar_photo_id, privacy, account_status, " +
  "is_admin_hidden_from_public_leaderboards, admin_hidden_at, is_founding_member, " +
  "analytics_opt_out, home_club_id, home_county_id, distance_units, " +
  "default_round_privacy, shake_to_feedback_enabled, onboarding_walkthrough_completed_at, " +
  "username_changed_at, last_seen_app_version, created_at, updated_at";

/**
 * Per-user detail — read-only v1. Reads the full profile through the
 * SERVER-ONLY service-role client (same RLS rationale as the directory:
 * `public.users` has no admin SELECT policy). Gated by the layout's
 * `requireAdmin()`. Set-status / hide / outreach controls land next via the
 * existing `is_admin()`-gated RPCs run on the session client.
 */
export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let supabase;
  try {
    supabase = await createServiceClient();
  } catch (e) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <BackLink />
        <div className="rounded-xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">
          {e instanceof Error ? e.message : "Service-role client unavailable."}
        </div>
      </div>
    );
  }

  const { data, error } = await supabase
    .from("users")
    .select(USER_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <BackLink />
        <div className="rounded-xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">
          Failed to load user: {error.message}.
        </div>
      </div>
    );
  }
  if (!data) notFound();

  const user = data as unknown as UserRow;

  // Resolve home club / county names (best-effort — a missing ref just hides
  // the field). Service-role read, so RLS never trims these.
  const [clubRes, countyRes] = await Promise.all([
    user.home_club_id
      ? supabase.from("clubs").select("name").eq("id", user.home_club_id).maybeSingle()
      : Promise.resolve({ data: null }),
    user.home_county_id
      ? supabase.from("counties").select("name").eq("id", user.home_county_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const clubName = (clubRes.data as { name?: string } | null)?.name ?? null;
  const countyName = (countyRes.data as { name?: string } | null)?.name ?? null;

  const baseUrl = await activeStorageBaseUrl();
  const avatar = avatarURL(user.id, user.avatar_photo_id, baseUrl);
  const name = user.display_name?.trim() || user.username;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BackLink />

      <SectionHeader
        eyebrow="People &amp; safety · Users"
        title={name}
        description={`@${user.username}`}
      />

      <section className="flex items-start gap-4 rounded-xl glass-panel p-5">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatar}
            alt={`${name}'s avatar`}
            className="size-20 shrink-0 rounded-full bg-paper-sunken object-cover"
          />
        ) : (
          <div
            aria-hidden
            className="flex size-20 shrink-0 items-center justify-center rounded-full bg-brand/15 text-xl font-semibold text-brand"
          >
            {initials(name)}
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip status={user.account_status} />
            {user.is_founding_member && (
              <span className="rounded-full border border-brand/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand">
                Founding member
              </span>
            )}
            {user.is_admin_hidden_from_public_leaderboards && (
              <span className="rounded-full border border-amber/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber">
                Hidden from leaderboards
              </span>
            )}
          </div>
          {user.bio ? (
            <p className="text-sm leading-snug text-ink-2">{user.bio}</p>
          ) : (
            <p className="text-sm italic text-ink-3">No bio set</p>
          )}
        </div>
      </section>

      <section className="rounded-xl glass-panel p-5">
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-2">
          Account
        </h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          <Field label="Account status" value={user.account_status} />
          <Field label="Profile privacy" value={prettyPrivacy(user.privacy)} />
          <Field label="Home club" value={clubName ?? (user.home_club_id ? "—" : "Not set")} />
          <Field label="Home county" value={countyName ?? (user.home_county_id ? "—" : "Not set")} />
          <Field label="Distance units" value={user.distance_units ?? "—"} />
          <Field
            label="Default round privacy"
            value={user.default_round_privacy ? prettyPrivacy(user.default_round_privacy as Privacy) : "—"}
          />
          <Field label="Analytics" value={user.analytics_opt_out ? "Opted out" : "Opted in"} />
          <Field
            label="Shake to feedback"
            value={user.shake_to_feedback_enabled === false ? "Off" : "On"}
          />
          <Field label="Last seen app version" value={user.last_seen_app_version ?? "—"} />
          <Field
            label="Onboarding"
            value={user.onboarding_walkthrough_completed_at ? "Completed" : "Incomplete"}
          />
        </dl>
      </section>

      <section className="rounded-xl glass-panel p-5">
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-2">
          Timeline
        </h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          <Field label="Joined" value={formatDate(user.created_at)} />
          <Field label="Profile updated" value={formatDate(user.updated_at)} />
          <Field label="Username changed" value={formatDate(user.username_changed_at)} />
          {user.is_admin_hidden_from_public_leaderboards && (
            <Field label="Hidden at" value={formatDate(user.admin_hidden_at)} />
          )}
          <Field label="User ID" value={user.id} mono />
        </dl>
      </section>

      <p className="text-xs text-ink-3">
        Read-only — set-status, hide, and outreach controls ship in the next slice.
      </p>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/users"
      className="inline-flex items-center gap-1.5 text-xs text-ink-2 hover:text-ink"
    >
      <ArrowLeft className="size-4" aria-hidden /> Back to users
    </Link>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
        {label}
      </dt>
      <dd className={"text-sm text-ink " + (mono ? "break-all font-mono text-xs text-ink-2" : "")}>
        {value}
      </dd>
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

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function prettyPrivacy(p: Privacy): string {
  switch (p) {
    case "onlyMe":
      return "Only me";
    case "friendsOnly":
      return "Friends only";
    case "everyone":
      return "Everyone";
    default:
      return p;
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
