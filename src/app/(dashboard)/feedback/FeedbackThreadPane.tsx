"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  Crown,
  ExternalLink,
  Gauge,
  Hash,
  Inbox,
  MapPin,
  Repeat,
  Rocket,
  Smartphone,
} from "lucide-react";
import Link from "next/link";
import type { AdminOption } from "@/lib/feedback/owners";
import type { ShippedVersion } from "@/lib/feedback/queue";
import {
  type FeedbackDuplicateLink,
  type FeedbackMessage,
  type FeedbackOwner,
  type FeedbackReport,
  type FeedbackReporter,
  type FeedbackScreenshot,
  type FeedbackSeverity,
  type FeedbackStatus,
  type FeedbackUserSeverity,
  areaSlugLabel,
  kindLabel,
  priorityLabel,
  priorityTone,
  reproducibilityLabel,
  severityLabel,
  statusLabel,
  userSeverityLabel,
  workStageLabel,
  workStageTone,
} from "@/lib/feedback/types";
import { Skeleton } from "@/components/admin/Skeleton";
import { Screenshots } from "./[id]/Screenshots";
import { ReplyForm } from "./[id]/ReplyForm";
import { SidePanelControls } from "./[id]/SidePanelControls";
import { ShipInVersionControl, type ShipVersionOption } from "./[id]/ShipInVersionControl";

type Thread = {
  report: FeedbackReport;
  reporter: FeedbackReporter | null;
  reporterAvatarUrl: string | null;
  owner: FeedbackOwner | null;
  messages: FeedbackMessage[];
  screenshots: FeedbackScreenshot[];
  signedURLs: Array<string | null>;
  duplicates: FeedbackDuplicateLink[];
  shippedVersions: ShippedVersion[];
  linkedCrashId: string | null;
};

/**
 * The inbox's right pane — one feedback thread, fetched client-side so picking
 * a report never navigates (filters + scroll preserved). Refetches when the
 * selected report's `signature` changes (its row's updated_at / last message),
 * which is how a mutation made via the controls reflects here: the action
 * revalidates `/feedback`, the server refreshes the list, the selected row's
 * signature changes, and this pane reloads.
 */
export function FeedbackThreadPane({
  reportId,
  signature,
  owners,
  currentAdminId,
  isSuperAdmin,
  draftVersions,
  onClose,
}: {
  reportId: string | null;
  signature: string;
  owners: AdminOption[];
  currentAdminId: string;
  isSuperAdmin: boolean;
  draftVersions: ShipVersionOption[];
  onClose?: () => void;
}) {
  const [thread, setThread] = useState<Thread | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    if (!reportId) return;
    const id = ++reqId.current;
    // All state writes live inside this async IIFE, never synchronously in the
    // effect body (the strict set-state-in-effect rule). Stale thread state from
    // a previous report is harmless — the component renders the empty state
    // whenever reportId is null, before reading `thread`.
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/feedback/thread?id=${encodeURIComponent(reportId)}`);
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j?.error ?? "Failed to load");
        }
        const data = (await res.json()) as Thread;
        if (id === reqId.current) {
          setThread(data);
          setError(null);
        }
      } catch (e: unknown) {
        if (id === reqId.current) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    })();
  }, [reportId, signature]);

  if (!reportId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-brand/10 text-brand">
          <Inbox className="size-5" />
        </span>
        <p className="font-display text-base font-semibold text-ink">Pick a report</p>
        <p className="max-w-xs text-sm text-ink-3">
          Select a report on the left to read the thread and triage it — without leaving the queue.
          Use <kbd className="kbd">J</kbd> / <kbd className="kbd">K</kbd> to move.
        </p>
      </div>
    );
  }

  if (loading && !thread) {
    return (
      <div className="space-y-4 p-5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !thread) {
    return (
      <div className="space-y-3 p-5">
        <PaneBack onClose={onClose} />
        <div className="rounded-xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">
          {error ?? "Couldn't load this report."}
        </div>
      </div>
    );
  }

  const { report, reporter, reporterAvatarUrl, owner } = thread;

  return (
    <div className="space-y-5 p-5">
      <div className="flex items-center justify-between gap-2">
        <PaneBack onClose={onClose} />
        <Link
          href={`/feedback/${report.id}`}
          className="inline-flex items-center gap-1 text-[11px] text-ink-3 transition-colors hover:text-ink-2"
          title="Open the full page (deep link)"
        >
          Open full page
          <ExternalLink aria-hidden className="size-3" />
        </Link>
      </div>

      <Header
        report={report}
        reporter={reporter}
        reporterAvatarUrl={reporterAvatarUrl}
        owner={owner}
        shippedVersions={thread.shippedVersions}
      />

      <div className="space-y-4">
        <ReportBody report={report} />
        {thread.screenshots.length > 0 && (
          <Screenshots screenshots={thread.screenshots} signedURLs={thread.signedURLs} />
        )}
        <ReportDetails report={report} />
        <Diagnostic report={report} />
        {report.linked_crash_id && (
          <LinkedCrash crashRowId={thread.linkedCrashId} sentryEventId={report.linked_crash_id} />
        )}
        {thread.duplicates.length > 0 && <Duplicates duplicates={thread.duplicates} />}

        <SidePanelControls
          reportId={report.id}
          reporterUserId={report.user_id}
          initialWorkStage={report.work_stage}
          initialReporterStatus={report.status}
          initialPriority={report.priority}
          initialOwnerUserId={report.owner_user_id}
          initialSeverity={report.severity}
          initialDuplicateOf={report.duplicate_of_report_id}
          owners={owners}
          currentAdminId={currentAdminId}
          isSuperAdmin={isSuperAdmin}
        />
        <ShipInVersionControl
          reportId={report.id}
          versions={draftVersions}
          shippedVersionIds={thread.shippedVersions.map((v) => v.id)}
        />

        <Timeline report={report} messages={thread.messages} />
        <ReplyForm reportId={report.id} />
      </div>
    </div>
  );
}

function PaneBack({ onClose }: { onClose?: () => void }) {
  if (!onClose) return <span />;
  return (
    <button
      type="button"
      onClick={onClose}
      className="inline-flex items-center gap-1 text-xs text-ink-3 transition-colors hover:text-ink-2 lg:hidden"
    >
      <ArrowLeft aria-hidden className="size-3.5" />
      Back to queue
    </button>
  );
}

// ── chips ─────────────────────────────────────────────────────────────
const CHIP =
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider";
type Tone = "brand" | "amber" | "alert" | "neutral";
function tone(t: Tone): string {
  return t === "brand"
    ? "border-brand/35 text-brand"
    : t === "amber"
      ? "border-amber/40 text-amber"
      : t === "alert"
        ? "border-alert/40 text-alert"
        : "border-rule/70 text-ink-3";
}
function sevTone(s: FeedbackSeverity | null): Tone {
  return s === "critical" ? "alert" : s === "high" ? "amber" : s === "medium" ? "brand" : "neutral";
}
function usTone(s: FeedbackUserSeverity | null): Tone {
  return s === "blocker" ? "alert" : s === "major" ? "amber" : s === "minor" ? "brand" : "neutral";
}
function statusTone(s: FeedbackStatus): Tone {
  return s === "new" || s === "resolved" ? "brand" : s === "inProgress" ? "amber" : "neutral";
}

function Header({
  report,
  reporter,
  reporterAvatarUrl,
  owner,
  shippedVersions,
}: {
  report: FeedbackReport;
  reporter: FeedbackReporter | null;
  reporterAvatarUrl: string | null;
  owner: FeedbackOwner | null;
  shippedVersions: ShippedVersion[];
}) {
  const display = reporter?.display_name ?? reporter?.username ?? "anonymous";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">
          {kindLabel(report.kind)}
        </span>
        <span aria-hidden className="text-ink-3">·</span>
        <span className="text-ink-3">filed {formatAbsolute(report.created_at)}</span>
        {report.is_founder && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-amber">
            <Crown aria-hidden className="size-3" />
            Founder
          </span>
        )}
      </div>
      <h2 className="font-display text-xl font-semibold leading-tight text-ink">
        {previewSentence(report.body)}
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`${CHIP} ${tone(workStageTone(report.work_stage))}`}>
          {workStageLabel(report.work_stage)}
        </span>
        {shippedVersions.map((v) => {
          const released = v.status === "released";
          return (
            <Link
              key={v.id}
              href={`/changelog/${v.id}`}
              className={`${CHIP} ${tone(released ? "brand" : "amber")} inline-flex items-center gap-1`}
            >
              {released ? <Rocket aria-hidden className="size-3" /> : <Clock aria-hidden className="size-3" />}
              {released ? `Shipped v${v.version}` : `Queued v${v.version}`}
            </Link>
          );
        })}
        {report.priority && (
          <span className={`${CHIP} ${tone(priorityTone(report.priority))}`}>
            {priorityLabel(report.priority)} priority
          </span>
        )}
        <span className={`${CHIP} ${tone(sevTone(report.severity))}`}>
          Sev · {severityLabel(report.severity)}
        </span>
      </div>
      <div className="flex items-center gap-2 text-xs">
        {reporterAvatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={reporterAvatarUrl} alt="" className="size-7 rounded-full bg-paper-sunken object-cover" />
        ) : (
          <span className="flex size-7 items-center justify-center rounded-full bg-paper-sunken text-[10px] font-semibold uppercase text-ink-3">
            {reporter ? display.slice(0, 2) : "—"}
          </span>
        )}
        <span className="font-medium text-ink">{reporter ? display : "Anonymous (deleted)"}</span>
        {reporter?.username && <span className="text-ink-3">@{reporter.username}</span>}
        {owner && (
          <span className="text-ink-3">
            · owner{" "}
            <span className="text-ink-2">
              {owner.display_name ?? (owner.username ? `@${owner.username}` : "admin")}
            </span>
          </span>
        )}
        {reporter && (
          <Link
            href={`/users/${reporter.id}`}
            className="ml-auto inline-flex items-center gap-0.5 text-[11px] font-medium text-brand transition-colors hover:underline"
          >
            View profile
            <ExternalLink aria-hidden className="size-3" />
          </Link>
        )}
      </div>
    </div>
  );
}

function ReportBody({ report }: { report: FeedbackReport }) {
  return (
    <article className="space-y-4 rounded-xl glass-panel p-5">
      <Field label="What happened" body={report.body} />
      {report.expected_behaviour && <Field label="Expected" body={report.expected_behaviour} />}
      {report.steps && <Field label="Steps to reproduce" body={report.steps} />}
      {report.resolution_note && <Field label="Resolution note" body={report.resolution_note} accent />}
    </article>
  );
}

function Field({ label, body, accent }: { label: string; body: string; accent?: boolean }) {
  return (
    <div className="space-y-1.5">
      <p className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${accent ? "text-brand" : "text-ink-3"}`}>
        {label}
      </p>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{body}</p>
    </div>
  );
}

function ReportDetails({ report }: { report: FeedbackReport }) {
  const hasArea = Boolean(report.area_label || report.area);
  if (!hasArea && !report.user_severity && !report.reproducibility) return null;
  return (
    <Card title="Report details">
      <ul className="space-y-2.5 text-xs text-ink-2">
        {hasArea && (
          <Row icon={MapPin} label="Location">
            {report.area_label ?? areaSlugLabel(report.area)}
          </Row>
        )}
        {report.user_severity && (
          <Row icon={Gauge} label="Reporter impact">
            <span className={`${CHIP} ${tone(usTone(report.user_severity))}`}>
              {userSeverityLabel(report.user_severity)}
            </span>
          </Row>
        )}
        {report.reproducibility && (
          <Row icon={Repeat} label="Reproduces">
            {reproducibilityLabel(report.reproducibility)}
          </Row>
        )}
      </ul>
    </Card>
  );
}

function Diagnostic({ report }: { report: FeedbackReport }) {
  return (
    <Card title="Diagnostic">
      <ul className="space-y-2.5 text-xs text-ink-2">
        <Row icon={Smartphone} label="Device">{report.device_model ?? "—"}</Row>
        <Row icon={Smartphone} label="iOS">{report.ios_version ?? "—"}</Row>
        <Row icon={Hash} label="App version">{report.app_version ?? "—"}</Row>
        <Row icon={Hash} label="Screen">{report.screen ?? "—"}</Row>
      </ul>
    </Card>
  );
}

function LinkedCrash({ crashRowId, sentryEventId }: { crashRowId: string | null; sentryEventId: string }) {
  if (crashRowId) {
    return (
      <Link
        href={`/crashes/${crashRowId}`}
        className="block space-y-2 rounded-xl border border-alert/40 bg-alert/5 p-4 transition-colors hover:border-alert/60"
      >
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-alert">
          <AlertTriangle aria-hidden className="size-3" /> Linked crash
        </p>
        <p className="font-mono text-[10px] text-ink-3">{sentryEventId}</p>
      </Link>
    );
  }
  return (
    <div className="space-y-2 rounded-xl border border-dashed border-rule/70 bg-paper-sunken/40 p-4 text-xs text-ink-3">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
        <AlertTriangle aria-hidden className="size-3" /> Linked crash · pending
      </p>
      <p className="font-mono text-[10px]">{sentryEventId}</p>
    </div>
  );
}

function Duplicates({ duplicates }: { duplicates: FeedbackDuplicateLink[] }) {
  return (
    <Card title={`Duplicates (${duplicates.length})`}>
      <ul className="space-y-2">
        {duplicates.slice(0, 6).map((dup) => (
          <li key={dup.id}>
            <Link
              href={`/feedback/${dup.id}`}
              className="flex items-start gap-2 rounded-lg border border-rule/60 bg-paper-sunken/40 p-2 text-xs text-ink-2 transition-colors hover:bg-paper-raised/40"
            >
              <span className={`${CHIP} ${tone(statusTone(dup.status))}`}>{statusLabel(dup.status)}</span>
              <span className="line-clamp-2 flex-1">{dup.body_preview}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Timeline({ report, messages }: { report: FeedbackReport; messages: FeedbackMessage[] }) {
  return (
    <article className="space-y-3 rounded-xl glass-panel p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">Thread</p>
      <ol className="space-y-2.5">
        <li className="rounded-lg border border-rule/60 bg-paper-sunken/40 p-3 text-xs">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
            User submitted · {formatAbsolute(report.created_at)}
          </p>
          <p className="mt-1.5 line-clamp-3 leading-relaxed text-ink-2">{report.body}</p>
        </li>
        {messages.map((m) => (
          <li key={m.id} className="rounded-lg border border-brand/25 bg-brand/5 p-3 text-xs">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand">
              {messageTitle(m)} · {formatAbsolute(m.created_at)}
            </p>
            {m.body && <p className="mt-1.5 whitespace-pre-wrap leading-relaxed text-ink-2">{m.body}</p>}
          </li>
        ))}
        {messages.length === 0 && (
          <li className="rounded-lg border border-dashed border-rule/60 bg-paper-sunken/30 p-3 text-xs text-ink-3">
            No replies yet.
          </li>
        )}
      </ol>
    </article>
  );
}

function messageTitle(m: FeedbackMessage): string {
  const role =
    m.author_role === "super_admin"
      ? "Admin"
      : m.author_role === "moderator"
        ? "Moderator"
        : m.author_role === "editor"
          ? "Editor"
          : "System";
  if (m.kind === "status_change") {
    const from = m.payload?.["from"];
    const to = m.payload?.["to"];
    if (typeof from === "string" && typeof to === "string") return `${role} · ${from} → ${to}`;
    return `${role} · status change`;
  }
  return `${role} · reply`;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-xl glass-panel p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">{title}</p>
      {children}
    </div>
  );
}

function Row({ icon: Icon, label, children }: { icon: typeof Hash; label: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Icon aria-hidden className="mt-0.5 size-3 text-ink-3" />
      <span className="w-24 shrink-0 text-ink-3">{label}</span>
      <span className="min-w-0 flex-1 text-ink-2">{children}</span>
    </li>
  );
}

function previewSentence(body: string): string {
  const t = body.trim();
  return t.length <= 120 ? t : t.slice(0, 117) + "…";
}

function formatAbsolute(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
