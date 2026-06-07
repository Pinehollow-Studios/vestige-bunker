import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  Hash,
  MessageSquareWarning,
  Smartphone,
} from "lucide-react";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { avatarURL } from "@/lib/storage";
import {
  getCrash,
  getLinkedFeedbackForCrash,
} from "@/lib/crashes/queries";
import {
  type CrashLevel,
  type CrashLinkedFeedback,
  type CrashReportEnriched,
  levelLabel,
} from "@/lib/crashes/types";
import {
  fetchSentryEvent,
  getSentryIssueURL,
  type SentryEventDetail,
} from "@/lib/sentry/client";

export const dynamic = "force-dynamic";

// Calm, single-tone bordered chips, matched to the queue page.
function levelChip(level: CrashLevel): string {
  switch (level) {
    case "fatal":
    case "error":
      return "border-alert/40 text-alert";
    case "warning":
      return "border-amber/40 text-amber";
    default:
      return "border-rule/70 text-ink-3";
  }
}

function environmentChip(env: string | null): string {
  if (env === "release") return "border-brand/40 text-brand";
  return "border-rule/70 text-ink-3";
}

/**
 * Crash detail. Three sections:
 *   1. Header — message, culprit, level / environment / release
 *      chips, "Open in Sentry" deep-link.
 *   2. Stack trace + breadcrumbs — pulled lazily from Sentry's Web
 *      API (server-side, cached 60s). Renders an inline "Sentry not
 *      reachable" placeholder when the API is unconfigured or down
 *      so the local data is still useful.
 *   3. Linked feedback — any `feedback_reports` rows whose
 *      `linked_crash_id` matches this crash's `sentry_event_id`.
 *      Closes the §13.4 close-the-loop story end-to-end.
 */
export default async function CrashDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAdmin();
  const crash = await getCrash(id);
  if (!crash) {
    notFound();
  }

  const linkedFeedback = await getLinkedFeedbackForCrash(crash.sentry_event_id);
  const sentryURL = getSentryIssueURL(crash.sentry_issue_id);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <BackLink />
      <CrashHeader crash={crash} sentryURL={sentryURL} />
      <CrashMetaGrid crash={crash} />
      <Suspense fallback={<SentryDetailSkeleton />}>
        <SentryDetailSection eventId={crash.sentry_event_id} />
      </Suspense>
      <LinkedFeedbackSection rows={linkedFeedback} />
    </div>
  );
}

// --------------------------------------------------------------
// Back link
// --------------------------------------------------------------

function BackLink() {
  return (
    <Link
      href="/crashes"
      className="inline-flex items-center gap-1 text-sm text-brand hover:underline"
    >
      <ArrowLeft className="size-3.5" />
      Back to queue
    </Link>
  );
}

// --------------------------------------------------------------
// Header
// --------------------------------------------------------------

function CrashHeader({
  crash,
  sentryURL,
}: {
  crash: CrashReportEnriched;
  sentryURL: string | null;
}) {
  const reporterAvatar = avatarURL(crash.user_id, crash.reporter_avatar_photo_id);
  const reporterDisplay =
    crash.reporter_display_name ?? crash.reporter_username ?? null;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-alert">
          Crash
        </span>
        <span aria-hidden className="text-ink-3">·</span>
        <span className="text-ink-3">first seen {formatAbsolute(crash.first_seen)}</span>
        <span aria-hidden className="text-ink-3">·</span>
        <span className="text-ink-3">last seen {formatAbsolute(crash.last_seen)}</span>
        {crash.event_count > 1 && (
          <>
            <span aria-hidden className="text-ink-3">·</span>
            <span className="text-ink-3">{crash.event_count} events</span>
          </>
        )}
      </div>
      <h1 className="display-serif text-3xl font-semibold leading-tight text-ink">
        {crash.message ?? crash.culprit ?? "(no message)"}
      </h1>
      {crash.culprit && crash.message && (
        <p className="font-mono text-sm text-ink-2">{crash.culprit}</p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${levelChip(crash.level)}`}
        >
          {levelLabel(crash.level)}
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${environmentChip(crash.environment)}`}
        >
          {crash.environment ?? "no env"}
        </span>
        {crash.release_name && (
          <span className="rounded-full border border-rule/70 px-3 py-1 font-mono text-xs text-ink-2">
            {crash.release_name}
          </span>
        )}
        {sentryURL && (
          <a
            href={sentryURL}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-brand/40 px-3 py-1 text-xs font-semibold text-brand transition-colors hover:bg-brand/10"
          >
            Open in Sentry
            <ExternalLink className="size-3" />
          </a>
        )}
        {crash.user_id && (
          <div className="flex items-center gap-2 text-xs text-ink-2">
            {reporterAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={reporterAvatar}
                alt=""
                className="size-7 rounded-full border border-rule/70 bg-paper-sunken object-cover"
              />
            ) : (
              <span
                aria-hidden
                className="flex size-7 items-center justify-center rounded-full border border-rule/70 bg-paper-sunken text-[10px] font-semibold uppercase text-ink-3"
              >
                {(reporterDisplay ?? "??").slice(0, 2)}
              </span>
            )}
            <span className="font-medium text-ink">{reporterDisplay ?? "anonymous"}</span>
            {crash.reporter_username && (
              <span className="text-ink-3">@{crash.reporter_username}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------
// Metadata grid (device, fingerprint, ids)
// --------------------------------------------------------------

function CrashMetaGrid({ crash }: { crash: CrashReportEnriched }) {
  return (
    <article className="grid grid-cols-1 gap-4 rounded-xl border border-rule/70 bg-paper-raised/50 p-4 sm:grid-cols-2">
      <MetaRow
        icon={<Smartphone className="size-3.5" />}
        label="Device"
        value={
          crash.device_model
            ? `${crash.device_model}${crash.os_version ? ` · iOS ${crash.os_version}` : ""}`
            : "—"
        }
      />
      <MetaRow
        icon={<Hash className="size-3.5" />}
        label="Fingerprint"
        value={crash.fingerprint ?? "—"}
        mono
      />
      <MetaRow
        icon={<Hash className="size-3.5" />}
        label="Sentry event ID"
        value={crash.sentry_event_id}
        mono
      />
      <MetaRow
        icon={<Hash className="size-3.5" />}
        label="Sentry issue ID"
        value={crash.sentry_issue_id}
        mono
      />
    </article>
  );
}

function MetaRow({
  icon,
  label,
  value,
  mono = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
        <span aria-hidden>{icon}</span>
        {label}
      </p>
      <p
        className={`break-all text-sm leading-relaxed text-ink ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

// --------------------------------------------------------------
// Sentry detail (lazy)
// --------------------------------------------------------------

async function SentryDetailSection({ eventId }: { eventId: string }) {
  const result = await fetchSentryEvent(eventId);

  if (!result.ok) {
    if (result.reason === "not_configured") {
      return (
        <article className="rounded-xl border border-dashed border-rule/70 bg-paper-raised/50 p-4 text-sm text-ink-3">
          Sentry API isn&apos;t configured for this dashboard. Set{" "}
          <code className="font-mono text-[11px]">SENTRY_AUTH_TOKEN</code>,{" "}
          <code className="font-mono text-[11px]">SENTRY_ORG_SLUG</code>, and{" "}
          <code className="font-mono text-[11px]">SENTRY_PROJECT_SLUG</code> in
          <code className="font-mono text-[11px]"> .env.local</code> (see{" "}
          <code className="font-mono text-[11px]">docs/sentry-setup.md</code>)
          to load stack traces + breadcrumbs inline.
        </article>
      );
    }
    if (result.reason === "not_found") {
      // Most common cases: webhook delivered an event id Sentry hasn't
      // propagated yet (race; refresh fixes), event was deleted server-
      // side, or the row is a synthetic test inserted via curl that
      // never went through Sentry at all.
      return (
        <article className="rounded-xl border border-dashed border-rule/70 bg-paper-raised/50 p-4 text-sm text-ink-3">
          This event isn&apos;t in Sentry. New events take a few seconds to
          propagate after the webhook fires — refresh in a moment. If this
          row was inserted by the smoke-test script (or any other path that
          bypassed the iOS SDK), the event will never appear in Sentry; the
          local row above is the only record.
        </article>
      );
    }
    return (
      <article className="rounded-xl border border-dashed border-rule/70 bg-paper-raised/50 p-4 text-sm text-ink-3">
        Couldn&apos;t reach Sentry to load stack trace + breadcrumbs. The
        local crash row above is the canonical record we have until Sentry
        is reachable again. Use the &quot;Open in Sentry&quot; button to view
        in Sentry directly.
      </article>
    );
  }

  return (
    <article className="space-y-4 rounded-xl border border-rule/70 bg-paper-raised/50 p-4">
      <header className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
          Stack trace + breadcrumbs (from Sentry)
        </p>
        <p className="text-[11px] text-ink-3">cached 60s</p>
      </header>
      <SentryEntries entries={result.event.entries} />
      <SentryTags tags={result.event.tags} />
    </article>
  );
}

function SentryDetailSkeleton() {
  return (
    <article className="rounded-xl border border-rule/70 bg-paper-raised/50 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
        Loading from Sentry…
      </p>
      <div className="mt-3 space-y-2">
        <div className="h-3 animate-pulse rounded bg-paper-sunken/60" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-paper-sunken/60" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-paper-sunken/60" />
      </div>
    </article>
  );
}

function SentryEntries({ entries }: { entries: SentryEventDetail["entries"] }) {
  const exception = entries.find((e) => e.type === "exception");
  const breadcrumbs = entries.find((e) => e.type === "breadcrumbs");
  return (
    <div className="space-y-4">
      {exception && <ExceptionEntry data={exception.data} />}
      {breadcrumbs && <BreadcrumbsEntry data={breadcrumbs.data} />}
      {!exception && !breadcrumbs && (
        <p className="text-xs text-ink-3">
          No exception or breadcrumb entries on this event. Open in Sentry for
          the raw payload.
        </p>
      )}
    </div>
  );
}

// Sentry's exception entry: { values: [{ type, value, stacktrace: { frames: [...] } }] }
function ExceptionEntry({ data }: { data: unknown }) {
  const values =
    (data as { values?: Array<{ type?: string; value?: string; stacktrace?: { frames?: unknown[] } }> })
      ?.values ?? [];
  if (values.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-alert">
        Exception
      </p>
      {values.map((v, i) => (
        <div
          key={i}
          className="space-y-2 rounded-xl border border-rule/60 bg-paper-sunken/40 p-3"
        >
          <p className="text-sm font-semibold text-ink">
            {v.type ?? "Error"}
            {v.value && <span className="font-normal text-ink-2">: {v.value}</span>}
          </p>
          {v.stacktrace?.frames && v.stacktrace.frames.length > 0 && (
            <StackFrames frames={v.stacktrace.frames} />
          )}
        </div>
      ))}
    </div>
  );
}

function StackFrames({ frames }: { frames: unknown[] }) {
  // Sentry orders frames most-recent last; reverse so the crash
  // site is at the top.
  const reversed = [...frames].reverse();
  return (
    <ol className="space-y-1 font-mono text-[11px] leading-snug">
      {reversed.map((f, i) => {
        const frame = f as {
          function?: string;
          filename?: string;
          lineNo?: number | null;
          inApp?: boolean;
          package?: string;
        };
        return (
          <li
            key={i}
            className={`flex flex-col rounded px-2 py-1 ${frame.inApp ? "bg-brand/10 text-ink" : "text-ink-3"}`}
          >
            <span>{frame.function ?? "(anonymous)"}</span>
            {frame.filename && (
              <span className="truncate">
                {frame.filename}
                {frame.lineNo != null && `:${frame.lineNo}`}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function BreadcrumbsEntry({ data }: { data: unknown }) {
  const values =
    (data as { values?: Array<{ category?: string; message?: string; level?: string; timestamp?: number }> })
      ?.values ?? [];
  if (values.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
        Breadcrumbs ({values.length})
      </p>
      <ol className="space-y-1 text-xs">
        {values.map((b, i) => (
          <li
            key={i}
            className="flex flex-col rounded border border-rule/60 bg-paper-sunken/30 px-2 py-1"
          >
            <span className="font-mono text-[10px] text-ink-3">
              {b.category ?? "—"} · {b.level ?? "info"}
            </span>
            {b.message && <span className="text-ink-2">{b.message}</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}

function SentryTags({ tags }: { tags: SentryEventDetail["tags"] }) {
  if (tags.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
        Tags
      </p>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag, i) => (
          <span
            key={i}
            className="rounded-full border border-rule/60 bg-paper-sunken/60 px-2 py-0.5 font-mono text-[10px] text-ink-2"
          >
            {tag.key}: {tag.value}
          </span>
        ))}
      </div>
    </div>
  );
}

// --------------------------------------------------------------
// Linked feedback
// --------------------------------------------------------------

function LinkedFeedbackSection({ rows }: { rows: CrashLinkedFeedback[] }) {
  return (
    <article className="space-y-3 rounded-xl border border-rule/70 bg-paper-raised/50 p-4">
      <header className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
          Linked feedback ({rows.length})
        </p>
        {rows.length > 0 && (
          <p className="text-[11px] text-ink-3">
            captured via the iOS form&apos;s `lastEventId()` hook
          </p>
        )}
      </header>
      {rows.length === 0 ? (
        <p className="text-xs text-ink-3">
          No feedback reports filed against this crash yet. The link is set
          when a user submits feedback while a Sentry event is in scope.
        </p>
      ) : (
        <ol className="space-y-2">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={`/feedback/${row.id}`}
                className="flex items-start gap-3 rounded-xl border border-rule/60 bg-paper-sunken/40 p-3 text-xs transition-colors hover:border-brand/40"
              >
                <MessageSquareWarning aria-hidden className="size-4 shrink-0 text-brand" />
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="block text-[10px] uppercase tracking-[0.14em] text-ink-3">
                    {row.status} · {formatAbsolute(row.created_at)}
                  </span>
                  <span className="block line-clamp-2 text-ink-2">
                    {row.body_preview}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}

// --------------------------------------------------------------
// Helpers
// --------------------------------------------------------------

function formatAbsolute(iso: string): string {
  // Locked en-GB per CLAUDE.md §3.6 — admin dashboard mirrors the
  // iOS app's "regionless en, UK style by default" posture rather
  // than picking up the runtime's default (Vercel runs en-US).
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
