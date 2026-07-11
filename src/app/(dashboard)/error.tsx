"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Dashboard-wide error boundary. Any page that throws lands here instead of a
 * blank screen — retry in place or bail to the overview.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-24 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-alert/10 text-alert">
        <AlertTriangle className="size-6" />
      </span>
      <div className="space-y-1.5">
        <h1 className="font-display text-xl font-semibold text-ink">Something went wrong</h1>
        <p className="text-sm text-ink-2">
          This screen hit an error. Retry, or head back to the overview.
        </p>
        {error.digest && <p className="font-mono text-[11px] text-ink-3">ref: {error.digest}</p>}
      </div>
      <div className="flex gap-2">
        <Button onClick={reset}>
          <RotateCw className="size-4" /> Retry
        </Button>
        <Button variant="outline" onClick={() => router.push("/")}>
          Overview
        </Button>
      </div>
    </div>
  );
}
