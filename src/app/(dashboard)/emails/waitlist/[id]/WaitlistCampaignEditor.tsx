"use client";

import { useMemo, useState, useTransition } from "react";
import { Ban, Clock, Send, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  cancelWaitlist,
  deleteWaitlist,
  scheduleWaitlist,
  sendWaitlistNow,
  updateWaitlistCampaign,
  type WaitlistCampaignPatch,
} from "../actions";
import { WaitlistTargetPicker } from "./WaitlistTargetPicker";
import { STATUS_CHIP, STATUS_LABELS, type WaitlistAudienceKind, type WaitlistCampaignRow } from "../types";

const SAMPLE: Record<string, string> = {
  first_name: "Tom",
  unsubscribe_url: "https://vestige.golf/unsubscribe/sample",
};

const TEXTAREA_CLS =
  "flex min-h-20 w-full rounded-lg border border-input bg-paper-sunken/40 px-3 py-2 text-sm transition-colors placeholder:text-ink-3 focus-visible:border-brand/60 focus-visible:bg-paper-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30";
const SELECT_CLS =
  "flex h-9 w-full rounded-lg border border-input bg-paper-sunken/40 px-3 py-1 text-sm transition-colors focus-visible:border-brand/60 focus-visible:bg-paper-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30";

function render(template: string, tokens: Record<string, string>): string {
  let out = template;
  for (const [key, value] of Object.entries(tokens)) out = out.split(`{{${key}}}`).join(value ?? "");
  return out.replace(/\{\{[a-zA-Z_]+\}\}/g, "");
}

export function WaitlistCampaignEditor({
  row,
  subscribedCount,
  initialTargets,
  isSuperAdmin,
}: {
  row: WaitlistCampaignRow;
  subscribedCount: number;
  initialTargets: string[];
  isSuperAdmin: boolean;
}) {
  const [name, setName] = useState(row.name);
  const [subject, setSubject] = useState(row.subject);
  const [preheader, setPreheader] = useState(row.preheader ?? "");
  const [html, setHtml] = useState(row.html);
  const [audienceKind, setAudienceKind] = useState<WaitlistAudienceKind>(row.audience_kind);
  const [targetCount, setTargetCount] = useState(initialTargets.length);

  const [pending, startTransition] = useTransition();

  const isSent = row.status === "sent" || row.status === "sending";
  const isCanceled = row.status === "canceled";
  const editable = !isSent && !isCanceled;

  const previewHtml = useMemo(() => render(html, SAMPLE), [html]);

  // How many will actually receive it — the whole subscribed list, or the picks.
  const recipientCount = audienceKind === "everyone" ? subscribedCount : targetCount;

  const patch: WaitlistCampaignPatch = {
    name,
    subject,
    preheader: preheader || null,
    html,
    audience_kind: audienceKind,
  };

  function saveDraft() {
    startTransition(async () => {
      const r = await updateWaitlistCampaign(row.id, patch);
      if (!r.ok) toast.error(r.message);
      else toast.success("Saved");
    });
  }

  function sendNow() {
    if (!subject.trim() || !html.trim()) {
      toast.error("Add a subject and HTML first.");
      return;
    }
    if (audienceKind === "individuals" && targetCount === 0) {
      toast.error("Pick at least one subscriber, or switch to Everyone.");
      return;
    }
    const who =
      audienceKind === "everyone"
        ? `all ${subscribedCount.toLocaleString()} subscribed addresses`
        : `${targetCount.toLocaleString()} selected ${targetCount === 1 ? "person" : "people"}`;
    if (!window.confirm(`Send this email to ${who} now? This can't be undone.`)) return;
    startTransition(async () => {
      const saved = await updateWaitlistCampaign(row.id, patch);
      if (!saved.ok) {
        toast.error(saved.message);
        return;
      }
      const r = await sendWaitlistNow(row.id);
      if (!r.ok) toast.error(r.message);
      else toast.success(`Queued ${r.data ?? 0} ${r.data === 1 ? "recipient" : "recipients"}`);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <Card title="Message">
          <Field label="Name" hint="Internal label — never shown to recipients.">
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={isCanceled} />
          </Field>
          <Field label="Subject" hint="The email subject line. {{first_name}} is filled per recipient.">
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} disabled={isCanceled} />
          </Field>
          <Field label="Preheader" hint="Optional preview line shown after the subject in most inboxes.">
            <Input value={preheader} onChange={(e) => setPreheader(e.target.value)} disabled={isCanceled} />
          </Field>

          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="HTML" hint="Placeholders: {{first_name}}, {{unsubscribe_url}}.">
              <textarea
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                spellCheck={false}
                disabled={isCanceled}
                className={cn(TEXTAREA_CLS, "h-[420px] resize-y font-mono text-xs leading-relaxed")}
              />
            </Field>
            <div className="space-y-1">
              <Label className="text-xs">Preview</Label>
              <div className="h-[420px] overflow-hidden rounded-lg border border-border bg-white">
                <iframe title="Email preview" sandbox="" srcDoc={previewHtml} className="h-full w-full border-0" />
              </div>
            </div>
          </div>
        </Card>

        <Card title="Who gets it">
          {editable ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <AudienceOption
                  active={audienceKind === "everyone"}
                  onClick={() => setAudienceKind("everyone")}
                  title="Everyone"
                  detail={`${subscribedCount.toLocaleString()} subscribed`}
                />
                <AudienceOption
                  active={audienceKind === "individuals"}
                  onClick={() => setAudienceKind("individuals")}
                  title="Specific people"
                  detail={targetCount > 0 ? `${targetCount} selected` : "pick from the list"}
                />
              </div>
              {audienceKind === "individuals" && (
                <div className="pt-1">
                  <WaitlistTargetPicker
                    campaignId={row.id}
                    initialSelected={initialTargets}
                    onCountChange={setTargetCount}
                  />
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-ink-2">
              {row.audience_kind === "everyone" ? "Sent to everyone on the list" : "Sent to selected people"}
              {row.status === "sent"
                ? ` · ${row.sent_count} sent${row.failed_count > 0 ? `, ${row.failed_count} failed` : ""}`
                : ""}
            </p>
          )}
        </Card>

        {editable && (
          <Button onClick={saveDraft} disabled={pending} className="w-full">
            {pending ? "Saving…" : "Save changes"}
          </Button>
        )}
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <DeliveryCard
          row={row}
          recipientCount={recipientCount}
          pending={pending}
          editable={editable}
          isSent={isSent}
          isSuperAdmin={isSuperAdmin}
          onSendNow={sendNow}
        />
      </div>
    </div>
  );
}

function AudienceOption({
  active,
  onClick,
  title,
  detail,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  detail: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-lg border p-3 text-left transition-colors",
        active ? "border-brand/50 bg-brand/5" : "border-rule/60 bg-paper-sunken/30 hover:bg-surface-2",
      )}
    >
      <p className={cn("text-sm font-medium", active ? "text-brand" : "text-ink")}>{title}</p>
      <p className="text-xs text-ink-3">{detail}</p>
    </button>
  );
}

function DeliveryCard({
  row,
  recipientCount,
  pending,
  editable,
  isSent,
  isSuperAdmin,
  onSendNow,
}: {
  row: WaitlistCampaignRow;
  recipientCount: number;
  pending: boolean;
  editable: boolean;
  isSent: boolean;
  isSuperAdmin: boolean;
  onSendNow: () => void;
}) {
  const [when, setWhen] = useState("");
  const [acting, startAction] = useTransition();
  const busy = pending || acting;

  function schedule() {
    if (!when) {
      toast.error("Pick a date and time.");
      return;
    }
    const iso = new Date(when).toISOString();
    startAction(async () => {
      const r = await scheduleWaitlist(row.id, iso);
      if (!r.ok) toast.error(r.message);
      else toast.success("Scheduled");
    });
  }

  function cancel() {
    if (!window.confirm("Cancel this email? It won't be sent.")) return;
    startAction(async () => {
      const r = await cancelWaitlist(row.id);
      if (!r.ok) toast.error(r.message);
      else toast.success("Canceled");
    });
  }

  function remove() {
    if (!window.confirm("Delete this email permanently?")) return;
    startAction(async () => {
      const r = await deleteWaitlist(row.id);
      if (r && !r.ok) toast.error(r.message);
    });
  }

  return (
    <section className="space-y-3 rounded-xl glass-panel p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">Delivery</h3>
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
            STATUS_CHIP[row.status],
          )}
        >
          {STATUS_LABELS[row.status]}
        </span>
      </div>

      {editable && (
        <p className="flex items-center gap-1.5 text-sm text-ink-2">
          <Users aria-hidden className="size-3.5 text-ink-3" />
          Goes to <span className="font-semibold tabular-nums text-ink">{recipientCount.toLocaleString()}</span>
          {recipientCount === 1 ? " person" : " people"}
        </p>
      )}
      {row.status === "sent" && (
        <p className="text-sm text-ink-2">
          Sent <span className="font-semibold tabular-nums text-ink">{row.sent_count}</span>
          {row.failed_count > 0 ? ` · ${row.failed_count} failed` : ""}
          {row.sent_at ? ` · ${new Date(row.sent_at).toLocaleString()}` : ""}
        </p>
      )}
      {row.status === "sending" && (
        <p className="text-sm text-ink-2">
          Sending… <span className="tabular-nums">{row.sent_count}</span>/{row.recipient_count ?? 0}
        </p>
      )}
      {row.status === "scheduled" && row.scheduled_at && (
        <p className="text-sm text-ink-2">Goes out {new Date(row.scheduled_at).toLocaleString()}</p>
      )}
      {row.status === "canceled" && <p className="text-sm text-ink-3">This email was canceled.</p>}

      {editable && (
        <>
          <Button onClick={onSendNow} disabled={busy} className="w-full bg-brand text-brand-fg hover:bg-brand-deep">
            <Send aria-hidden className="size-4" /> Send now
          </Button>

          <div className="space-y-1.5 rounded-lg border border-rule/70 bg-paper-sunken/30 p-3">
            <Label className="flex items-center gap-1.5 text-xs">
              <Clock aria-hidden className="size-3.5" /> Or schedule for later
            </Label>
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className={SELECT_CLS}
            />
            <Button onClick={schedule} disabled={busy || !when} variant="outline" size="sm" className="w-full">
              {row.status === "scheduled" ? "Reschedule" : "Schedule"}
            </Button>
          </div>

          {row.status === "scheduled" && (
            <Button onClick={cancel} disabled={busy} variant="ghost" size="sm" className="w-full text-alert">
              <Ban aria-hidden className="size-4" /> Cancel
            </Button>
          )}
        </>
      )}

      {isSuperAdmin && !isSent && (
        <Button onClick={remove} disabled={busy} variant="ghost" size="sm" className="w-full text-alert">
          <Trash2 aria-hidden className="size-4" /> Delete
        </Button>
      )}
    </section>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-xl glass-panel p-5">
      <header>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">{title}</h3>
      </header>
      {children}
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground/80">{hint}</p>}
    </div>
  );
}
