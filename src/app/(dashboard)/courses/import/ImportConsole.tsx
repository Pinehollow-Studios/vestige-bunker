"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  GitCommit,
  Loader2,
  RefreshCw,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import type { ImportPreview } from "@/lib/courses-import/preview";
import { applyImport, previewImport, type ImportStatus } from "./actions";

export function ImportConsole({ status }: { status: ImportStatus }) {
  const router = useRouter();
  const [sha, setSha] = useState(status.latestCommit?.sha ?? "");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [previewedSha, setPreviewedSha] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [applying, setApplying] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const shaValid = /^[0-9a-f]{40}$/.test(sha.trim());

  if (!status.configured) {
    return (
      <Notice tone="warn">
        {status.error ?? "Course import isn't configured on this deployment yet."}
      </Notice>
    );
  }

  const runPreview = () => {
    setPreview(null);
    startTransition(async () => {
      const res = await previewImport(sha.trim());
      if (!res.ok) return void toast.error(res.message);
      setPreview(res.preview);
      setPreviewedSha(res.sha);
      const total = res.preview.newCourses.length + res.preview.newCounties.length;
      toast.success(total > 0 ? `${total} new item${total === 1 ? "" : "s"} to add` : "Nothing new - already in sync");
    });
  };

  const openConfirm = () => {
    if (!preview || previewedSha !== sha.trim()) {
      return void toast.error("Preview this commit first.");
    }
    setConfirmOpen(true);
  };

  const doApply = () => {
    setApplying(true);
    startTransition(async () => {
      const res = await applyImport(sha.trim());
      setApplying(false);
      setConfirmOpen(false);
      if (!res.ok) return void toast.error(res.message);
      toast.success(`Imported ${res.courses} courses · ${res.counties} counties`);
      setPreview(null);
      setPreviewedSha(null);
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      <StatusPanel status={status} />

      {status.error && <Notice tone="warn">{status.error}</Notice>}

      <section className="space-y-4 rounded-xl glass-panel p-5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">
          Pull from Fairways-web
        </h2>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-ink-2">Commit to import</span>
          <input
            value={sha}
            onChange={(e) => setSha(e.target.value)}
            spellCheck={false}
            placeholder="40-character commit SHA"
            className="w-full rounded-lg border border-input bg-paper-sunken/40 px-3 py-2 font-mono text-[12px] text-ink outline-none focus:border-brand/60 focus:bg-paper-raised"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" disabled={pending || !shaValid} onClick={runPreview}>
            {pending && !applying ? (
              <Loader2 aria-hidden className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw aria-hidden className="size-3.5" />
            )}
            Preview changes
          </Button>
          {status.latestCommit && sha.trim() !== status.latestCommit.sha && (
            <button
              type="button"
              onClick={() => setSha(status.latestCommit!.sha)}
              className="text-[11px] text-ink-3 underline-offset-2 transition-colors hover:text-brand hover:underline"
            >
              Use latest commit
            </button>
          )}
        </div>

        {preview && previewedSha === sha.trim() && (
          <PreviewResult preview={preview} />
        )}

        <div className="space-y-2 border-t border-rule/50 pt-4">
          <Button
            disabled={pending || !preview || previewedSha !== sha.trim()}
            onClick={openConfirm}
            className="bg-brand text-brand-fg hover:bg-brand-deep"
          >
            <UploadCloud aria-hidden className="size-4" />
            Apply to live app
          </Button>
          <p className="text-[11px] text-ink-3">
            Writes to the live app - you&rsquo;ll get a confirmation first. Preview a commit to
            enable.
          </p>
        </div>
      </section>

      <ConfirmDialog
        open={confirmOpen}
        title="Apply to the live app?"
        confirmLabel="Apply now"
        busy={applying}
        onConfirm={doApply}
        onCancel={() => {
          if (!applying) setConfirmOpen(false);
        }}
      >
        <p>
          This updates the <strong className="text-ink">live</strong> course data players see:{" "}
          <strong className="text-ink">{preview?.newCourses.length ?? 0}</strong> new course
          {(preview?.newCourses.length ?? 0) === 1 ? "" : "s"} added and{" "}
          <strong className="text-ink">{preview?.updatedCourses ?? 0}</strong> refreshed
          {preview && preview.newCounties.length > 0
            ? `, plus ${preview.newCounties.length} new ${preview.newCounties.length === 1 ? "county" : "counties"}`
            : ""}
          .
        </p>
        <p className="mt-2 text-ink-3">
          Upsert-only - nothing is deleted, so it&rsquo;s reversible by re-applying an earlier
          commit.
        </p>
      </ConfirmDialog>
    </div>
  );
}

function StatusPanel({ status }: { status: ImportStatus }) {
  const { latestCommit, lastImport, commitsAhead } = status;
  const upToDate = lastImport && latestCommit && lastImport.sha === latestCommit.sha;

  return (
    <section className="space-y-3 rounded-xl glass-panel p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">
          Sync status
        </h2>
        {upToDate ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/35 px-2.5 py-0.5 text-[11px] font-semibold text-brand">
            <Check aria-hidden className="size-3" /> Up to date
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber/40 px-2.5 py-0.5 text-[11px] font-semibold text-amber">
            <AlertTriangle aria-hidden className="size-3" />
            {commitsAhead != null && commitsAhead > 0
              ? `${commitsAhead} new commit${commitsAhead === 1 ? "" : "s"}`
              : lastImport
                ? "Out of sync"
                : "Never imported"}
          </span>
        )}
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <Row label="Latest in Fairways-web">
          {latestCommit ? (
            <span className="space-y-0.5">
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-ink-2">
                <GitCommit aria-hidden className="size-3 text-ink-3" />
                {latestCommit.sha.slice(0, 10)}
              </span>
              <span className="block truncate text-xs text-ink-3" title={latestCommit.message}>
                {latestCommit.message || "-"}
              </span>
            </span>
          ) : (
            <span className="text-xs text-ink-3">unavailable</span>
          )}
        </Row>
        <Row label="Last imported">
          {lastImport ? (
            <span className="space-y-0.5">
              <span className="font-mono text-[11px] text-ink-2">{lastImport.sha.slice(0, 10)}</span>
              <span className="block text-xs text-ink-3">
                {lastImport.finishedAt
                  ? `${lastImport.courses ?? "-"} courses · ${formatDate(lastImport.finishedAt)}`
                  : lastImport.error
                    ? `failed · ${formatDate(lastImport.startedAt)}`
                    : `in progress · ${formatDate(lastImport.startedAt)}`}
              </span>
            </span>
          ) : (
            <span className="text-xs text-ink-3">no import on record</span>
          )}
        </Row>
      </dl>
    </section>
  );
}

function PreviewResult({ preview }: { preview: ImportPreview }) {
  const newCount = preview.newCourses.length;
  return (
    <div className="space-y-3 rounded-lg border border-rule/60 bg-paper-sunken/30 p-4">
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <Stat n={newCount} label="new courses" tone={newCount > 0 ? "brand" : "muted"} />
        <Stat n={preview.updatedCourses} label="refreshed" tone="muted" />
        <Stat n={preview.newCounties.length} label="new counties" tone={preview.newCounties.length > 0 ? "brand" : "muted"} />
        <Stat n={preview.sourceCourses} label="in source" tone="muted" />
      </div>

      {preview.newCounties.length > 0 && (
        <p className="text-xs text-ink-2">
          <span className="text-ink-3">New counties:</span> {preview.newCounties.join(", ")}
        </p>
      )}

      {newCount > 0 ? (
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">
            New courses
          </p>
          <ul className="max-h-48 space-y-0.5 overflow-y-auto pr-1 text-xs text-ink-2">
            {preview.newCourses.map((c) => (
              <li key={c.fid} className="flex items-baseline justify-between gap-3">
                <span className="truncate">{c.name}</span>
                <span className="shrink-0 text-[10px] text-ink-3">{c.county ?? "-"}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-ink-3">
          No new courses at this commit - existing rows would be refreshed in place.
        </p>
      )}
    </div>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone: "brand" | "muted" }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span
        className={`font-display text-lg font-semibold tabular-nums ${tone === "brand" ? "text-brand" : "text-ink"}`}
      >
        {n}
      </span>
      <span className="text-[11px] text-ink-3">{label}</span>
    </span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Notice({ tone, children }: { tone: "warn"; children: React.ReactNode }) {
  void tone;
  return (
    <div className="flex items-start gap-2 rounded-xl border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-ink-2">
      <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-amber" />
      <p>{children}</p>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
