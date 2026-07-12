"use client";

import { useTransition } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { sendTestEmail } from "./actions";

/**
 * Send the current draft to your own inbox. The single most reassuring thing
 * before a real send — see exactly how it lands. Only ever goes to you.
 */
export function SendTestButton({
  subject,
  html,
  preheader,
  disabled,
}: {
  subject: string;
  html: string;
  preheader?: string | null;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function send() {
    if (!subject.trim() || !html.trim()) {
      toast.error("Add a subject and content first.");
      return;
    }
    startTransition(async () => {
      const r = await sendTestEmail(subject, html, preheader ?? null);
      if (!r.ok) toast.error(r.message);
      else toast.success(`Test sent to ${r.data?.to ?? "your inbox"}`);
    });
  }

  return (
    <Button onClick={send} disabled={pending || disabled} variant="outline" size="sm" className="w-full">
      <Send aria-hidden className="size-4" />
      {pending ? "Sending test…" : "Send a test to me"}
    </Button>
  );
}
