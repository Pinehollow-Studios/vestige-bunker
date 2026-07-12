"use client";

import { useTransition } from "react";
import { DownloadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { importWaitlistFromResend } from "./actions";

/**
 * Pull the existing Resend contacts into our own waitlist table. Idempotent —
 * safe to press again; it re-syncs (upsert by email). Needed once so Jack's
 * already-collected waitlist becomes sendable + measurable from here.
 */
export function ImportFromResendButton() {
  const [pending, startTransition] = useTransition();

  function run() {
    if (pending) return;
    startTransition(async () => {
      const r = await importWaitlistFromResend();
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      const { imported } = r.data ?? { imported: 0 };
      toast.success(
        imported === 0 ? "Already up to date — nothing new to import." : `Imported ${imported.toLocaleString()} contacts from Resend.`,
      );
    });
  }

  return (
    <Button onClick={run} disabled={pending} variant="outline" size="sm">
      <DownloadCloud className="size-4" />
      {pending ? "Importing…" : "Import from Resend"}
    </Button>
  );
}
