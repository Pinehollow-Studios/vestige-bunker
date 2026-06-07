"use client";

import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { postReply } from "../actions";

type Props = {
  reportId: string;
};

/**
 * Plain-text reply form. Slice 4 ships the body-only path; the
 * attachment-uploader lands in slice 6 (admin polish).
 *
 * Submits via the `postReply` server action. On success the form
 * resets and the page revalidates so the new reply appears in the
 * timeline. On error we toast the server message — admin-side, so
 * exposing the raw Postgres error string is fine.
 */
export function ReplyForm({ reportId }: Props) {
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    if (!body.trim() || isPending) return;
    const formData = new FormData();
    formData.append("body", body);
    startTransition(async () => {
      const result = await postReply(reportId, formData);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Reply sent — they'll see it next time they open the app.");
      setBody("");
    });
  };

  return (
    <article className="space-y-3 rounded-xl border border-rule/70 bg-paper-raised/50 p-5">
      <header className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand">
          Reply
        </p>
        <p className="text-[11px] text-ink-3">
          Plain text · read verbatim in-app
        </p>
      </header>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={5}
        placeholder="Tell them what's happening — that you're looking into it, that it's fixed, that you need more info."
        disabled={isPending}
        className="block w-full resize-y rounded-lg border border-rule/70 bg-paper-sunken/40 p-3 text-sm leading-relaxed text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30 disabled:opacity-60"
      />
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={isPending || !body.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-fg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Send aria-hidden className="size-3.5" />
          {isPending ? "Sending…" : "Send reply"}
        </button>
      </div>
    </article>
  );
}
