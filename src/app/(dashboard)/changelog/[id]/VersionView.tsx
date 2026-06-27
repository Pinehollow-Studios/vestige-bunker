import { cn } from "@/lib/utils";
import { ChangeLinesView } from "../ChangeLinesView";
import {
  type AppVersion,
  type AppVersionChange,
  type LinkedFeedback,
  VERSION_STATUS_LABELS,
  versionStatusBadgeClasses,
} from "../types";

/** Read-only presentation of a single version — the default mode of the detail
 *  page. Edit affordances live behind the View/Edit toggle. */
export function VersionView({
  version,
  changes,
  linkedFeedback,
}: {
  version: AppVersion;
  changes: AppVersionChange[];
  linkedFeedback: Record<string, LinkedFeedback>;
}) {
  return (
    <article className="space-y-4 rounded-2xl glass-panel p-6">
      <header className="space-y-2 border-b border-rule/50 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-hero text-2xl leading-none text-ink">v{version.version}</h1>
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              versionStatusBadgeClasses(version.status),
            )}
          >
            {VERSION_STATUS_LABELS[version.status]}
          </span>
          {version.released_at && (
            <span className="text-xs text-ink-3">{formatDate(version.released_at)}</span>
          )}
        </div>
        {version.title && (
          <p className="font-heading text-base font-semibold text-ink">{version.title}</p>
        )}
        {version.summary && <p className="text-sm text-ink-2">{version.summary}</p>}
      </header>

      <ChangeLinesView changes={changes} linkedFeedback={linkedFeedback} />
    </article>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
