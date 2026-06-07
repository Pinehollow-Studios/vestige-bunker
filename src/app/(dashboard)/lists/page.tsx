import { CalendarClock, Clock, Hash, ListChecks, MapPin } from "lucide-react";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { avatarURL, listCoverURL } from "@/lib/storage";
import { QueueActions } from "./QueueActions";

/**
 * Row shape returned by `admin_list_verification_queue()` after
 * the 2026-05-03 enrichment migration
 * (`20260503111000_admin_verification_queue_enrich.sql`).
 *
 * Server orders oldest-first by `verification_requested_at` so
 * the dashboard renders straight through without sorting.
 */
type CourseRow = {
  course_id: string;
  course_name: string;
  club_name: string | null;
  county_name: string | null;
  position: number | null;
};

type QueueRow = {
  list_id: string;
  list_name: string;
  list_description: string | null;
  privacy_kind: string;
  cover_storage_key: string | null;
  created_at: string;
  updated_at: string;
  verification_requested_at: string;
  owner_user_id: string;
  owner_username: string;
  owner_display_name: string | null;
  owner_first_name: string | null;
  owner_avatar_photo_id: string | null;
  owner_bio: string | null;
  course_count: number;
  // `jsonb_agg` on the SQL side serialises into a typed array
  // here. Capped at 500 server-side; if the cap bites,
  // `course_count > courses.length`.
  courses: CourseRow[] | null;
};

export const dynamic = "force-dynamic";

export default async function ListVerificationPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_verification_queue");
  const queue = (data as QueueRow[] | null) ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <SectionHeader
        eyebrow="Queues · review"
        title="List verification"
        description="Public user lists awaiting the verified stamp — oldest first, work top to bottom."
      />

      {error && (
        <div className="rounded-xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">
          Failed to load queue: {error.message}
        </div>
      )}

      {!error && queue.length === 0 && <EmptyQueue />}

      {queue.length > 0 && (
        <>
          <QueueSummary queue={queue} />
          <ol className="snap-y snap-proximity space-y-6">
            {queue.map((row, index) => (
              <li key={row.list_id} className="snap-start scroll-mt-6">
                <QueueCard
                  row={row}
                  position={index + 1}
                  total={queue.length}
                />
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

function EmptyQueue() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-rule/70 bg-paper-raised/50 px-4 py-12 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-brand/15 text-brand">
        <ListChecks className="size-5" aria-hidden />
      </span>
      <p className="display-serif text-lg text-ink">Queue is clear</p>
      <p className="text-sm text-ink-2">No public lists are awaiting verification.</p>
    </div>
  );
}

function QueueSummary({ queue }: { queue: QueueRow[] }) {
  const oldest = queue[0]?.verification_requested_at;
  const newest = queue[queue.length - 1]?.verification_requested_at;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rule/70 bg-paper-raised/50 px-4 py-3 text-xs text-ink-2">
      <div className="flex items-center gap-2">
        <span aria-hidden className="size-2 rounded-full bg-brand" />
        <span className="font-semibold text-ink">
          {queue.length} {queue.length === 1 ? "list" : "lists"} waiting
        </span>
        <span className="text-ink-3">·</span>
        <span className="text-ink-3">oldest first</span>
      </div>
      {oldest && (
        <div className="flex items-center gap-3 text-ink-3">
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock aria-hidden className="size-3" />
            Top of queue waiting{" "}
            <span className="font-medium text-ink">{formatRequested(oldest)}</span>
          </span>
          {queue.length > 1 && newest && (
            <>
              <span aria-hidden>·</span>
              <span>
                Newest <span className="font-medium text-ink">{formatRequested(newest)}</span>
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function QueueCard({
  row,
  position,
  total,
}: {
  row: QueueRow;
  position: number;
  total: number;
}) {
  const coverURL = listCoverURL(row.cover_storage_key);
  const ownerAvatarURL = avatarURL(row.owner_user_id, row.owner_avatar_photo_id);
  const courses = row.courses ?? [];
  const truncated = courses.length < row.course_count;

  return (
    <article className="overflow-hidden rounded-xl border border-rule/70 bg-paper-raised/50">
      <CoverBanner
        url={coverURL}
        title={row.list_name}
        position={position}
        total={total}
        waitingFor={formatRequested(row.verification_requested_at)}
      />

      <div className="flex flex-col gap-4 p-5">
        <header className="space-y-2">
          <div className="flex items-start gap-3">
            <div className="flex-1 space-y-1">
              <h2 className="display-serif text-xl font-semibold leading-tight text-ink">
                {row.list_name}
              </h2>
              <p className="flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
                <Clock aria-hidden className="size-3" />
                Requested {formatRequested(row.verification_requested_at)}
                <span aria-hidden>·</span>
                <span>created {formatDate(row.created_at)}</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge
                variant="outline"
                className="border-brand/40 text-brand"
              >
                {row.privacy_kind}
              </Badge>
              <Badge variant="outline" className="border-rule/70 text-ink-2">
                <Hash aria-hidden className="size-3" />
                {row.course_count}{" "}
                {row.course_count === 1 ? "course" : "courses"}
              </Badge>
              {truncated && (
                <Badge variant="outline" className="border-amber/40 text-amber">
                  truncated to {courses.length}
                </Badge>
              )}
            </div>
          </div>
        </header>

        {row.list_description && (
          <section className="rounded-xl border border-rule/70 bg-paper-sunken/50 p-3 text-sm leading-relaxed text-ink-2">
            {row.list_description}
          </section>
        )}

        <OwnerBlock
          displayName={row.owner_display_name}
          firstName={row.owner_first_name}
          username={row.owner_username}
          avatarURL={ownerAvatarURL}
          bio={row.owner_bio}
        />

        <CourseList courses={courses} totalCount={row.course_count} />

        <footer className="flex justify-end pt-2">
          <QueueActions listId={row.list_id} listName={row.list_name} />
        </footer>
      </div>
    </article>
  );
}

function CoverBanner({
  url,
  title,
  position,
  total,
  waitingFor,
}: {
  url: string | null;
  title: string;
  position: number;
  total: number;
  waitingFor: string;
}) {
  return (
    <div className="relative aspect-video w-full overflow-hidden border-b border-rule/70 bg-paper-sunken">
      {url ? (
        // Plain <img> rather than next/image — see comment retained
        // from the original implementation.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={`Cover for ${title}`}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs uppercase tracking-wider text-ink-3">
          No cover
        </div>
      )}
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
        <span className="rounded-full border border-rule/70 bg-paper-raised/85 px-2.5 py-1 text-xs font-semibold tabular-nums text-ink backdrop-blur-sm">
          {position} / {total}
          {position === 1 && total > 1 && (
            <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wider text-brand">
              Oldest
            </span>
          )}
        </span>
        <span className="rounded-full border border-rule/70 bg-paper-raised/85 px-2.5 py-1 text-xs text-ink-2 backdrop-blur-sm">
          Waiting <span className="font-semibold text-ink">{waitingFor}</span>
        </span>
      </div>
    </div>
  );
}

function OwnerBlock({
  displayName,
  firstName,
  username,
  avatarURL,
  bio,
}: {
  displayName: string | null;
  firstName: string | null;
  username: string;
  avatarURL: string | null;
  bio: string | null;
}) {
  const initials = ownerInitials({ displayName, firstName, username });
  const heading = displayName ?? firstName ?? username;
  return (
    <section className="flex items-start gap-3 rounded-xl border border-rule/70 bg-paper-sunken/40 p-3">
      {avatarURL ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarURL}
          alt={`${heading}'s avatar`}
          className="size-10 shrink-0 rounded-full bg-paper-sunken object-cover"
        />
      ) : (
        <div
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand/15 text-sm font-semibold text-brand"
        >
          {initials}
        </div>
      )}
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-semibold leading-tight text-ink">
          {heading}
          <span className="ml-1.5 text-xs font-normal text-ink-3">@{username}</span>
        </p>
        {bio ? (
          <p className="text-xs leading-snug text-ink-2">{bio}</p>
        ) : (
          <p className="text-xs italic text-ink-3">No bio set</p>
        )}
      </div>
    </section>
  );
}

function CourseList({
  courses,
  totalCount,
}: {
  courses: CourseRow[];
  totalCount: number;
}) {
  if (totalCount === 0) {
    return (
      <section className="rounded-xl border border-rule/70 p-3 text-center text-xs text-ink-3">
        No courses on this list.
      </section>
    );
  }
  return (
    <section className="space-y-2">
      <details className="group rounded-xl border border-rule/70 bg-paper-sunken/40">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-ink-2 select-none">
          <span className="inline-flex items-center gap-1.5">
            <ListChecks aria-hidden className="size-3.5 text-brand" />
            Courses ({totalCount})
          </span>
          <span className="text-ink-3 group-open:hidden">Show all</span>
          <span className="hidden text-ink-3 group-open:inline">Hide</span>
        </summary>
        <ol className="divide-y divide-rule/60 border-t border-rule/70 text-sm">
          {courses.map((course, index) => (
            <li
              key={course.course_id}
              className="flex items-baseline gap-3 px-3 py-2"
            >
              <span className="w-6 shrink-0 text-right text-xs tabular-nums text-ink-3">
                {course.position ?? index + 1}.
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{course.course_name}</p>
                <p className="flex items-center gap-1 truncate text-xs text-ink-3">
                  {course.county_name && <MapPin aria-hidden className="size-3" />}
                  {[course.club_name, course.county_name]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}

function ownerInitials({
  displayName,
  firstName,
  username,
}: {
  displayName: string | null;
  firstName: string | null;
  username: string;
}): string {
  const source = displayName ?? firstName ?? username;
  const parts = source.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  if (parts.length === 1 && parts[0].length > 0) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return "?";
}

function formatRequested(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.round(diffMs / 60_000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.round(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
