"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Rocket } from "lucide-react";
import { shipReportInVersion } from "../../changelog/actions";

export type ShipVersionOption = {
  id: string;
  version: string;
  title: string | null;
};

/**
 * Close the changelog↔feedback loop from the feedback side: one click attaches
 * this report to a version in development as a new (prefilled, "Fixed") change
 * line. Versions the report is already shipped in are filtered out.
 */
export function ShipInVersionControl({
  reportId,
  versions,
  shippedVersionIds,
}: {
  reportId: string;
  versions: ShipVersionOption[];
  shippedVersionIds: string[];
}) {
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const shipped = new Set(shippedVersionIds);
  const available = versions.filter((v) => !shipped.has(v.id));

  const ship = (v: ShipVersionOption) => {
    setBusyId(v.id);
    startTransition(async () => {
      const res = await shipReportInVersion(v.id, reportId);
      setBusyId(null);
      if (!res.ok) toast.error(res.message);
      else toast.success(`Added to v${v.version}`);
    });
  };

  return (
    <div className="space-y-3 rounded-xl glass-panel p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
        Ship in version
      </p>
      {versions.length === 0 ? (
        <p className="text-xs text-ink-3">
          No version in development.{" "}
          <Link href="/changelog" className="text-brand hover:underline">
            Open the changelog
          </Link>{" "}
          to start one.
        </p>
      ) : available.length === 0 ? (
        <p className="text-xs text-ink-3">Already added to every open version.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {available.map((v) => (
            <button
              key={v.id}
              type="button"
              disabled={pending}
              onClick={() => ship(v)}
              title={v.title ?? undefined}
              className="inline-flex items-center gap-1.5 rounded-md border border-amber/40 bg-amber/10 px-2.5 py-1 text-[11px] font-semibold text-amber transition-colors hover:bg-amber/15 disabled:opacity-60"
            >
              {busyId === v.id ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Rocket className="size-3" />
              )}
              v{v.version}
            </button>
          ))}
        </div>
      )}
      <p className="text-[10px] text-ink-3">
        Adds a prefilled &quot;Fixed&quot; line to that version, tagged to this report. Tweak
        the wording in the changelog.
      </p>
    </div>
  );
}
