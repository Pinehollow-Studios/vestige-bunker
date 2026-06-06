import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  Crown,
  Gauge,
  Hash,
  MapPin,
  Repeat,
  Smartphone,
  Tag,
} from "lucide-react";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { avatarURL } from "@/lib/storage";
import { getCrashForFeedback } from "@/lib/crashes/queries";
import { feedbackScreenshotSignedURLs } from "@/lib/feedback/signedUrl";
import { Screenshots } from "./Screenshots";
import { ReplyForm } from "./ReplyForm";
import { SidePanelControls } from "./SidePanelControls";
import {
  type FeedbackDuplicateLink,
  type FeedbackMessage,
  type FeedbackReport,
  type FeedbackReporter,
  type FeedbackScreenshot,
  type FeedbackStatus,
  areaSlugLabel,
  kindLabel,
  reproducibilityLabel,
  severityChipClasses,
  severityLabel,
  statusChipClasses,
  statusLabel,
  userSeverityChipClasses,
  userSeverityLabel,
} from "@/lib/feedback/types";

export const dynamic = "force-dynamic";

type ThreadResponse = {
  report: FeedbackReport | null;
  reporter: FeedbackReporter | null;
  messages: FeedbackMessage[] | null;
  screenshots: FeedbackScreenshot[] | null;
  duplicates: FeedbackDuplicateLink[] | null;
};

/**
 * Read-only thread detail. Slice 1 ships the view; slice 4 layers
 * on the side panel with status / severity / tags / duplicate /
 * block / delete + the reply form.
 *
 * The single SECURITY DEFINER `admin_feedback_thread(p_report_id)`
 * RPC returns one row with five jsonb columns, so a single
 * round-trip backs the whole page.
 */
export default async function FeedbackThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .rpc("admin_feedback_thread", { p_report_id: id })
    .single<ThreadResponse>();

  if (error) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <SectionHeader
          title="Feedback report"
          description="Failed to load this report."
        />
        <div className="rounded-2xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">
          {error.message}
        </div>
        <Link
          href="/feedback"
          className="inline-flex items-center gap-1 text-sm text-brand-deep hover:underline dark:text-brand-soft"
        >
          <ArrowLeft className="size-3.5" />
          Back to queue
        </Link>
      </div>
    );
  }

  if (!data || !data.report) {
    notFound();
  }

  const report = data.report;
  const reporter = data.reporter;
  const messages = data.messages ?? [];
  const screenshots = data.screenshots ?? [];
  const duplicates = data.duplicates ?? [];

  const signedURLs = await feedbackScreenshotSignedURLs(
    screenshots.map((s) => s.storage_path),
  );

  // Resolve the linked crash row, if the iOS form captured one via
  // SentrySDK.lastEventId at submit time (CLAUDE.md §13.4). Returns
  // null when the report has no link OR when the Sentry webhook
  // hasn't ingested the matching crash row yet.
  const linkedCrash = report.linked_crash_id
    ? await getCrashForFeedback(report.id)
    : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <BackLink />

      <ReportHeader report={report} reporter={reporter} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4 min-w-0">
          <ReportBody report={report} />
          {screenshots.length > 0 && (
            <Screenshots
              screenshots={screenshots}
              signedURLs={signedURLs}
            />
          )}
          <ThreadTimeline report={report} messages={messages} />
          <ReplyForm reportId={report.id} />
        </div>
        <aside className="space-y-4">
          <SidePanelControls
            reportId={report.id}
            reporterUserId={report.user_id}
            initialStatus={report.status}
            initialSeverity={report.severity}
            initialTags={report.tags ?? []}
            initialDuplicateOf={report.duplicate_of_report_id}
            isSuperAdmin={admin.role === "super_admin"}
          />
          <ReportDetailsMeta report={report} />
          <SidebarMeta report={report} />
          {report.linked_crash_id && (
            <LinkedCrashCard
              crashRowId={linkedCrash?.id ?? null}
              sentryEventId={report.linked_crash_id}
            />
          )}
          {duplicates.length > 0 && <DuplicatesPanel duplicates={duplicates} />}
        </aside>
      </div>
    </div>
  );
}

// --------------------------------------------------------------
// Header
// --------------------------------------------------------------

function ReportHeader({
  report,
  reporter,
}: {
  report: FeedbackReport;
  reporter: FeedbackReporter | null;
}) {
  const reporterAvatar = reporter
    ? avatarURL(reporter.id, reporter.avatar_photo_id)
    : null;
  const reporterDisplay =
    reporter?.display_name ?? reporter?.username ?? "anonymous";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-deep dark:text-brand-soft">
          {kindLabel(report.kind)}
        </span>
        <span aria-hidden className="text-ink-3">
          ·
        </span>
        <span className="text-ink-3">filed {formatAbsolute(report.created_at)}</span>
        {report.is_founder && (
          <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
            <Crown aria-hidden className="size-3" />
            Founder
          </span>
        )}
      </div>
      <h1 className="display-serif text-3xl font-semibold leading-tight text-ink">
        {previewSentence(report.body)}
      </h1>
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${statusChipClasses(report.status)}`}
        >
          {statusLabel(report.status)}
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${severityChipClasses(report.severity)}`}
        >
          Severity · {severityLabel(report.severity)}
        </span>
        {reporter ? (
          <div className="ml-auto flex items-center gap-2 text-xs text-ink-2">
            {reporterAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={reporterAvatar}
                alt=""
                className="size-7 rounded-full bg-paper-sunken object-cover ring-1 ring-foreground/10"
              />
            ) : (
              <span
                aria-hidden
                className="flex size-7 items-center justify-center rounded-full bg-paper-sunken text-[10px] font-semibold uppercase text-ink-3 ring-1 ring-foreground/10"
              >
                {reporterDisplay.slice(0, 2)}
              </span>
            )}
            <span className="font-medium text-ink">{reporterDisplay}</span>
            {reporter.username && (
              <span className="text-ink-3">@{reporter.username}</span>
            )}
          </div>
        ) : (
          <span className="ml-auto text-xs italic text-ink-3">
            Anonymous (account deleted)
          </span>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------
// Body + screenshots
// --------------------------------------------------------------

function ReportBody({ report }: { report: FeedbackReport }) {
  return (
    <article className="space-y-4 rounded-2xl border border-border bg-paper-raised p-5 ring-1 ring-foreground/5">
      <Section label="What happened" body={report.body} />
      {report.expected_behaviour && (
        <Section label="Expected" body={report.expected_behaviour} />
      )}
      {report.steps && <Section label="Steps to reproduce" body={report.steps} />}
      {report.resolution_note && (
        <Section
          label="Resolution note"
          body={report.resolution_note}
          tone="resolved"
        />
      )}
    </article>
  );
}

function Section({
  label,
  body,
  tone = "default",
}: {
  label: string;
  body: string;
  tone?: "default" | "resolved";
}) {
  const labelClasses =
    tone === "resolved"
      ? "text-emerald-700 dark:text-emerald-300"
      : "text-ink-3";
  return (
    <div className="space-y-1.5">
      <p
        className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${labelClasses}`}
      >
        {label}
      </p>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
        {body}
      </p>
    </div>
  );
}

// --------------------------------------------------------------
// Thread timeline (read-only)
// --------------------------------------------------------------

function ThreadTimeline({
  report,
  messages,
}: {
  report: FeedbackReport;
  messages: FeedbackMessage[];
}) {
  return (
    <article className="space-y-3 rounded-2xl border border-border bg-paper-raised p-5 ring-1 ring-foreground/5">
      <header className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
          Thread
        </p>
        <p className="text-[11px] text-ink-3">
          Reply below to fan a notification to the reporter.
        </p>
      </header>
      <ol className="space-y-3">
        <li className="rounded-xl border border-border/60 bg-paper-sunken/40 p-3 text-xs">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
            User submitted · {formatAbsolute(report.created_at)}
          </p>
          <p className="mt-1 line-clamp-3 text-ink-2">{report.body}</p>
        </li>
        {messages.map((message) => (
          <li
            key={message.id}
            className="rounded-xl border border-border/60 bg-paper-sunken/40 p-3 text-xs"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-deep dark:text-brand-soft">
              {messageTitle(message)} · {formatAbsolute(message.created_at)}
            </p>
            {message.body && (
              <p className="mt-1 whitespace-pre-wrap text-ink-2">
                {message.body}
              </p>
            )}
            {message.attachment_storage_path && (
              <p className="mt-1 truncate font-mono text-[10px] text-ink-3">
                attachment: {message.attachment_storage_path}
              </p>
            )}
          </li>
        ))}
        {messages.length === 0 && (
          <li className="rounded-xl border border-dashed border-border/60 bg-paper-sunken/30 p-3 text-xs text-ink-3">
            No replies yet.
          </li>
        )}
      </ol>
    </article>
  );
}

function messageTitle(message: FeedbackMessage): string {
  const role = message.author_role;
  const roleLabel =
    role === "super_admin"
      ? "Admin"
      : role === "moderator"
        ? "Moderator"
        : role === "editor"
          ? "Editor"
          : "System";
  if (message.kind === "status_change") {
    const from = message.payload?.["from"];
    const to = message.payload?.["to"];
    if (typeof from === "string" && typeof to === "string") {
      return `${roleLabel} · ${from} → ${to}`;
    }
    return `${roleLabel} · status change`;
  }
  return `${roleLabel} · reply`;
}

// --------------------------------------------------------------
// Sidebar
// --------------------------------------------------------------

function ReportDetailsMeta({ report }: { report: FeedbackReport }) {
  const hasArea = Boolean(report.area_label || report.area);
  if (!hasArea && !report.user_severity && !report.reproducibility) {
    return null;
  }
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-paper-raised p-4 ring-1 ring-foreground/5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
        Report details
      </p>
      <ul className="space-y-2 text-xs text-ink-2">
        {hasArea && (
          <MetaRow icon={MapPin} label="Location">
            {report.area_label ?? areaSlugLabel(report.area)}
          </MetaRow>
        )}
        {report.user_severity && (
          <MetaRow icon={Gauge} label="Reporter impact">
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${userSeverityChipClasses(report.user_severity)}`}
            >
              {userSeverityLabel(report.user_severity)}
            </span>
          </MetaRow>
        )}
        {report.reproducibility && (
          <MetaRow icon={Repeat} label="Reproduces">
            {reproducibilityLabel(report.reproducibility)}
          </MetaRow>
        )}
      </ul>
    </div>
  );
}

function SidebarMeta({ report }: { report: FeedbackReport }) {
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-paper-raised p-4 ring-1 ring-foreground/5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
        Diagnostic
      </p>
      <ul className="space-y-2 text-xs text-ink-2">
        <MetaRow icon={Smartphone} label="Device">
          {report.device_model ?? "—"}
        </MetaRow>
        <MetaRow icon={Smartphone} label="iOS">
          {report.ios_version ?? "—"}
        </MetaRow>
        <MetaRow icon={Hash} label="App version">
          {report.app_version ?? "—"}
        </MetaRow>
        <MetaRow icon={Hash} label="Screen">
          {report.screen ?? "—"}
        </MetaRow>
        {report.tags && report.tags.length > 0 && (
          <MetaRow icon={Tag} label="Tags">
            <span className="flex flex-wrap gap-1">
              {report.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full border border-border bg-paper-sunken px-2 py-0.5 text-[10px] text-ink-2"
                >
                  {tag}
                </span>
              ))}
            </span>
          </MetaRow>
        )}
        {report.linked_crash_id && (
          <MetaRow icon={Hash} label="Linked crash">
            <span className="font-mono text-[10px] text-ink-3">
              {report.linked_crash_id}
            </span>
          </MetaRow>
        )}
      </ul>
      {report.category_context && Object.keys(report.category_context).length > 0 && (
        <div className="space-y-1 border-t border-border pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
            Category context
          </p>
          <pre className="overflow-x-auto rounded bg-paper-sunken/60 p-2 text-[10px] text-ink-2">
            {JSON.stringify(report.category_context, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function MetaRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Hash;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-2">
      <Icon aria-hidden className="mt-0.5 size-3 text-ink-3" />
      <span className="w-20 shrink-0 text-ink-3">{label}</span>
      <span className="min-w-0 flex-1 text-ink-2">{children}</span>
    </li>
  );
}

function DuplicatesPanel({
  duplicates,
}: {
  duplicates: FeedbackDuplicateLink[];
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-paper-raised p-4 ring-1 ring-foreground/5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
        Duplicates of this report ({duplicates.length})
      </p>
      <ul className="space-y-2">
        {duplicates.slice(0, 6).map((dup) => (
          <li key={dup.id}>
            <Link
              href={`/feedback/${dup.id}`}
              className="flex items-start gap-2 rounded-lg border border-border/60 bg-paper-sunken/40 p-2 text-xs text-ink-2 hover:border-brand/40"
            >
              <span
                className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusBadgeClass(dup.status)}`}
              >
                {statusLabel(dup.status)}
              </span>
              <span className="line-clamp-2 flex-1 text-ink-2">
                {dup.body_preview}
              </span>
              <ChevronRight aria-hidden className="size-3 text-ink-3" />
            </Link>
          </li>
        ))}
        {duplicates.length > 6 && (
          <li className="text-[10px] text-ink-3">
            +{duplicates.length - 6} more
          </li>
        )}
      </ul>
    </div>
  );
}

function statusBadgeClass(status: FeedbackStatus): string {
  return statusChipClasses(status);
}

// --------------------------------------------------------------
// Linked crash card
// --------------------------------------------------------------

/**
 * Surfaces the Sentry crash that prompted this feedback report
 * (CLAUDE.md §13.4). The link is captured at iOS-form-submit time
 * via `SentrySDK.lastEventId()`. Two states:
 *   - resolved: row exists in `crash_reports`, render a clickable
 *     card linking to `/crashes/[id]`.
 *   - pending: feedback row has `linked_crash_id` set but the
 *     Sentry webhook hasn't ingested the crash yet (race; user
 *     submits feedback faster than Sentry retries the webhook).
 *     Render the event UUID with a "pending" hint so the operator
 *     knows the link will become live.
 */
function LinkedCrashCard({
  crashRowId,
  sentryEventId,
}: {
  crashRowId: string | null;
  sentryEventId: string;
}) {
  if (crashRowId) {
    return (
      <Link
        href={`/crashes/${crashRowId}`}
        className="block space-y-2 rounded-2xl border border-alert/40 bg-alert/5 p-4 ring-1 ring-foreground/5 transition-colors hover:border-alert/60"
      >
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-alert">
          <AlertTriangle aria-hidden className="size-3" />
          Linked crash
        </p>
        <p className="text-xs text-ink-2">
          This report was filed while a Sentry event was in scope. Open the
          crash for stack trace + breadcrumbs.
        </p>
        <p className="font-mono text-[10px] text-ink-3">{sentryEventId}</p>
      </Link>
    );
  }
  return (
    <div className="space-y-2 rounded-2xl border border-dashed border-border/70 bg-paper-sunken/40 p-4 text-xs text-ink-3 ring-1 ring-foreground/5">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
        <AlertTriangle aria-hidden className="size-3" />
        Linked crash · pending
      </p>
      <p>
        The user submitted this report with a Sentry event in scope, but the
        webhook hasn&apos;t ingested it yet. Refresh in a few seconds.
      </p>
      <p className="font-mono text-[10px] text-ink-3">{sentryEventId}</p>
    </div>
  );
}

// --------------------------------------------------------------
// Back link
// --------------------------------------------------------------

function BackLink() {
  return (
    <Link
      href="/feedback"
      className="inline-flex items-center gap-1 text-xs text-ink-2 hover:text-ink"
    >
      <ArrowLeft aria-hidden className="size-3.5" />
      Back to queue
    </Link>
  );
}

// --------------------------------------------------------------
// Helpers
// --------------------------------------------------------------

function previewSentence(body: string): string {
  const trimmed = body.trim();
  if (trimmed.length <= 120) return trimmed;
  return trimmed.slice(0, 117) + "…";
}

function formatAbsolute(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
