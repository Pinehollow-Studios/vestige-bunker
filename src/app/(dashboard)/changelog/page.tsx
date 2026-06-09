import Link from "next/link";
import { Pencil, Rocket } from "lucide-react";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { cn } from "@/lib/utils";
import { NewVersionButton } from "./NewVersionButton";
import { ChangeLinesView } from "./ChangeLinesView";
import {
  type AppVersion,
  type AppVersionChange,
  type LinkedFeedback,
  compareVersionsDesc,
  currentVersion,
  VERSION_STATUS_LABELS,
} from "./types";

export const dynamic = "force-dynamic";

/**
 * Changelog — the full, read-only release log: every version with its change
 * lines, newest first, in one scroll (what a viewer reads). A prominent banner
 * derives the current shipped version (highest released). Each version links to
 * its focused View page; an Edit affordance jumps straight to the editor.
 *
 * Forward-compat: a missing-relation error (tables not deployed) renders the
 * unconfigured state rather than throwing.
 */
export default async function ChangelogPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [versionsRes, changesRes] = await Promise.all([
    supabase
      .from("app_versions")
      .select("*")
      .order("major", { ascending: false })
      .order("minor", { ascending: false })
      .order("patch", { ascending: false }),
    supabase
      .from("app_version_changes")
      .select("id, version_id, kind, summary, feedback_report_id, sort_index, created_at, updated_at")
      .order("sort_index", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  const notConfigured =
    !!versionsRes.error && isMissingRelation(versionsRes.error.message);

  const versions = ((versionsRes.data as AppVersion[] | null) ?? [])
    .slice()
    .sort(compareVersionsDesc);
  const changes = (changesRes.data as AppVersionChange[] | null) ?? [];

  // Group change lines by version (already globally sorted by sort_index).
  const changesByVersion = new Map<string, AppVersionChange[]>();
  for (const c of changes) {
    const list = changesByVersion.get(c.version_id) ?? [];
    list.push(c);
    changesByVersion.set(c.version_id, list);
  }

  // Hydrate the linked feedback reports in one batch for the "report" chips.
  const linkedIds = Array.from(
    new Set(changes.map((c) => c.feedback_report_id).filter(Boolean) as string[]),
  );
  const linkedFeedback: Record<string, LinkedFeedback> = {};
  if (linkedIds.length > 0) {
    const { data: reports } = await supabase
      .from("feedback_reports")
      .select("id, kind, status, body")
      .in("id", linkedIds);
    for (const r of (reports as LinkedFeedback[] | null) ?? []) {
      linkedFeedback[r.id] = r;
    }
  }

  const current = currentVersion(versions);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <SectionHeader
        eyebrow="Editorial"
        title="Changelog"
        description="What shipped in each version of the app — and which reported bugs each release tackled."
        actions={<NewVersionButton />}
      />

      {versionsRes.error && !notConfigured && (
        <div className="rounded-2xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">
          Failed to load versions: {versionsRes.error.message}
        </div>
      )}

      {notConfigured && <NotConfigured />}

      {!notConfigured && current && <CurrentVersionBanner version={current} />}

      {!versionsRes.error && versions.length === 0 && <EmptyState />}

      {!notConfigured && versions.length > 0 && (
        <div className="space-y-4">
          {versions.map((version) => (
            <VersionSection
              key={version.id}
              version={version}
              changes={changesByVersion.get(version.id) ?? []}
              linkedFeedback={linkedFeedback}
              isCurrent={current?.id === version.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CurrentVersionBanner({ version }: { version: AppVersion }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-brand/30 bg-brand/5 p-5">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-brand">
        <Rocket className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand">
          Current version
        </p>
        <p className="font-hero text-2xl leading-tight text-ink">
          {version.version}
          {version.title && (
            <span className="ml-2 align-middle text-sm font-normal text-ink-2">
              {version.title}
            </span>
          )}
        </p>
      </div>
      {version.released_at && (
        <span className="shrink-0 text-xs text-ink-3">
          shipped {formatDate(version.released_at)}
        </span>
      )}
    </div>
  );
}

function VersionSection({
  version,
  changes,
  linkedFeedback,
  isCurrent,
}: {
  version: AppVersion;
  changes: AppVersionChange[];
  linkedFeedback: Record<string, LinkedFeedback>;
  isCurrent: boolean;
}) {
  const released = version.status === "released";
  return (
    <section className="space-y-4 rounded-xl glass-panel p-5">
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/changelog/${version.id}`}
              className="font-heading text-lg font-semibold leading-snug text-ink transition-colors hover:text-brand"
            >
              v{version.version}
            </Link>
            {isCurrent && (
              <span className="inline-flex items-center rounded-full border border-brand/35 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand">
                Current
              </span>
            )}
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                released ? "border-brand/35 text-brand" : "border-rule/70 text-ink-3",
              )}
            >
              {VERSION_STATUS_LABELS[version.status]}
            </span>
            {version.released_at && (
              <span className="text-xs text-ink-3">{formatDate(version.released_at)}</span>
            )}
          </div>
          {version.title && <p className="text-sm text-ink-2">{version.title}</p>}
          {version.summary && <p className="text-xs text-ink-3">{version.summary}</p>}
        </div>
        <Link
          href={`/changelog/${version.id}?mode=edit`}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-rule/60 px-2 py-1 text-[11px] text-ink-3 transition-colors hover:border-brand/40 hover:text-brand"
        >
          <Pencil aria-hidden className="size-3" />
          Edit
        </Link>
      </header>

      <ChangeLinesView changes={changes} linkedFeedback={linkedFeedback} />
    </section>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl glass-panel p-12 text-center">
      <div className="flex flex-col items-center gap-2">
        <span className="flex size-10 items-center justify-center rounded-full bg-brand/15 text-brand">
          <Rocket className="size-5" />
        </span>
        <p className="font-display text-base font-semibold text-ink">No versions yet</p>
        <p className="text-sm text-ink-2">
          Add your first version to start tracking what ships in each release.
        </p>
      </div>
    </div>
  );
}

function NotConfigured() {
  return (
    <div className="rounded-xl glass-panel p-12 text-center">
      <div className="flex flex-col items-center gap-2">
        <span className="flex size-10 items-center justify-center rounded-full bg-paper-sunken text-ink-3">
          <Rocket className="size-5" />
        </span>
        <p className="font-display text-base font-semibold text-ink">Changelog not wired here</p>
        <p className="mx-auto max-w-md text-sm text-ink-2">
          The changelog tables aren&apos;t in this Supabase project yet. Push the
          <span className="font-mono text-xs"> 20260609100000_app_version_changelog.sql</span>{" "}
          migration to prod to enable this surface.
        </p>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** True when a PostgREST error reads like "relation/function does not exist". */
function isMissingRelation(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("does not exist") ||
    m.includes("could not find") ||
    m.includes("schema cache") ||
    m.includes("not found")
  );
}
