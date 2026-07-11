"use client";

import { useMemo, useState, useTransition } from "react";
import { Ban, Clock, RefreshCw, Send, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { AudiencePicker } from "@/components/admin/AudiencePicker";
import { searchUsers } from "@/app/(dashboard)/notifications/actions";
import {
  cancelCampaign,
  deleteCampaign,
  loadCampaignRecipients,
  scheduleCampaign,
  sendCampaignNow,
  setCampaignTargets,
  updateCampaign,
  type CampaignPatch,
} from "../actions";
import {
  STATUS_CHIP,
  STATUS_LABELS,
  type CampaignAudienceKind,
  type CampaignTarget,
  type CampaignRecipientRow,
  type CountyOption,
  type EmailCampaignRow,
  type UserPickRow,
} from "../types";

/** A starter template the composer can seed subject + HTML from. */
export type TemplateSeed = { key: string; name: string; subject: string; html: string };

/** Sample values so the live preview renders realistically (mirrors EmailsSection). */
const SAMPLE: Record<string, string> = {
  first_name: "Tom",
  unsubscribe_url: "https://vestige.golf/unsubscribe/sample",
};

const TEXTAREA_CLS =
  "flex min-h-20 w-full rounded-lg border border-input bg-paper-sunken/40 px-3 py-2 text-sm transition-colors placeholder:text-ink-3 focus-visible:border-brand/60 focus-visible:bg-paper-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30";
const SELECT_CLS =
  "flex h-9 w-full rounded-lg border border-input bg-paper-sunken/40 px-3 py-1 text-sm transition-colors focus-visible:border-brand/60 focus-visible:bg-paper-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30";

/** Substitute {{token}} placeholders then strip unresolved ones (mirrors the sender). */
function render(template: string, tokens: Record<string, string>): string {
  let out = template;
  for (const [key, value] of Object.entries(tokens)) {
    out = out.split(`{{${key}}}`).join(value ?? "");
  }
  return out.replace(/\{\{[a-zA-Z_]+\}\}/g, "");
}

export function EmailCampaignEditor({
  row,
  initialTargetUsers,
  counties,
  templates,
  isSuperAdmin,
}: {
  row: EmailCampaignRow;
  initialTargetUsers: UserPickRow[];
  counties: CountyOption[];
  templates: TemplateSeed[];
  isSuperAdmin: boolean;
}) {
  const [name, setName] = useState(row.name);
  const [subject, setSubject] = useState(row.subject);
  const [preheader, setPreheader] = useState(row.preheader ?? "");
  const [html, setHtml] = useState(row.html);
  const [bypass, setBypass] = useState(row.bypass_marketing_consent);
  const [audienceKind, setAudienceKind] = useState<CampaignAudienceKind>(row.audience_kind);
  const [minVersion, setMinVersion] = useState(row.min_app_version ?? "");
  const [maxVersion, setMaxVersion] = useState(row.max_app_version ?? "");
  const [target, setTarget] = useState<CampaignTarget>(row.target ?? {});

  const [pending, startTransition] = useTransition();

  const isSent = row.status === "sent" || row.status === "sending";
  const isCanceled = row.status === "canceled";
  const editable = !isSent && !isCanceled;

  const previewHtml = useMemo(() => render(html, SAMPLE), [html]);

  const patch: CampaignPatch = {
    name,
    subject,
    preheader: preheader || null,
    html,
    bypass_marketing_consent: bypass,
    audience_kind: audienceKind,
    min_app_version: minVersion || null,
    max_app_version: maxVersion || null,
    target: audienceKind === "filtered" ? target : {},
  };

  function saveDraft() {
    startTransition(async () => {
      const r = await updateCampaign(row.id, patch);
      if (!r.ok) toast.error(r.message);
      else toast.success("Saved");
    });
  }

  function seedFrom(key: string) {
    const t = templates.find((x) => x.key === key);
    if (!t) return;
    if ((html.trim() || subject.trim()) && !window.confirm("Replace the current subject + HTML with this template?")) {
      return;
    }
    setSubject(t.subject);
    setHtml(t.html);
    toast.success(`Started from “${t.name}”`);
  }

  function sendNow() {
    if (!subject.trim() || !html.trim()) {
      toast.error("Add a subject and HTML first.");
      return;
    }
    const who = audienceKind === "everyone" ? "everyone" : "the selected audience";
    const consent = bypass
      ? "This is a service message — it ignores the marketing opt-out."
      : "Opted-out members are excluded automatically.";
    if (!window.confirm(`Send this email to ${who} now? ${consent} This can't be undone.`)) return;
    startTransition(async () => {
      const saved = await updateCampaign(row.id, patch);
      if (!saved.ok) {
        toast.error(saved.message);
        return;
      }
      const r = await sendCampaignNow(row.id);
      if (!r.ok) toast.error(r.message);
      else toast.success(`Queued ${r.data ?? 0} ${r.data === 1 ? "recipient" : "recipients"}`);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* Form */}
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

          {editable && templates.length > 0 && (
            <Field label="Start from a template">
              <select
                className={SELECT_CLS}
                value=""
                onChange={(e) => { if (e.target.value) { seedFrom(e.target.value); e.currentTarget.value = ""; } }}
              >
                <option value="">Choose a template to copy in…</option>
                {templates.map((t) => (
                  <option key={t.key} value={t.key}>{t.name}</option>
                ))}
              </select>
            </Field>
          )}

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

          {editable && (
            <label className="flex items-start gap-2 rounded-lg border border-alert/30 bg-alert/5 p-2.5 text-sm text-ink-2">
              <input
                type="checkbox"
                checked={bypass}
                onChange={(e) => setBypass(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="inline-flex items-center gap-1 font-medium text-alert">
                  <ShieldCheck aria-hidden className="size-3.5" /> Service message
                </span>{" "}
                - bypass the marketing unsubscribe. Operational/account mail only.
              </span>
            </label>
          )}
        </Card>

        {editable ? (
          <Card title="Who gets it">
            <AudiencePicker
              audienceKind={audienceKind}
              setAudienceKind={setAudienceKind}
              target={target}
              setTarget={setTarget}
              minVersion={minVersion}
              setMinVersion={setMinVersion}
              maxVersion={maxVersion}
              setMaxVersion={setMaxVersion}
              counties={counties}
              entityId={row.id}
              initialTargetUsers={initialTargetUsers}
              onPersistTargets={(ids) => setCampaignTargets(row.id, ids)}
              onSearchUsers={searchUsers}
            />
          </Card>
        ) : (
          <Card title="Who got it">
            <p className="text-sm text-ink-2">
              {row.audience_kind}
              {row.status === "sent"
                ? ` · ${row.sent_count} sent${row.failed_count > 0 ? `, ${row.failed_count} failed` : ""}`
                : ""}
            </p>
          </Card>
        )}

        {editable && (
          <Button onClick={saveDraft} disabled={pending} className="w-full">
            {pending ? "Saving…" : "Save changes"}
          </Button>
        )}

        {isSent && <RecipientsPanel campaignId={row.id} />}
      </div>

      {/* Sticky delivery */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <DeliveryCard
          row={row}
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

// ── Delivery lifecycle ─────────────────────────────────────────────────

function DeliveryCard({
  row,
  pending,
  editable,
  isSent,
  isSuperAdmin,
  onSendNow,
}: {
  row: EmailCampaignRow;
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
      const r = await scheduleCampaign(row.id, iso);
      if (!r.ok) toast.error(r.message);
      else toast.success("Scheduled");
    });
  }

  function cancel() {
    if (!window.confirm("Cancel this campaign? It won't be sent.")) return;
    startAction(async () => {
      const r = await cancelCampaign(row.id);
      if (!r.ok) toast.error(r.message);
      else toast.success("Canceled");
    });
  }

  function remove() {
    if (!window.confirm("Delete this campaign permanently?")) return;
    startAction(async () => {
      const r = await deleteCampaign(row.id);
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
      {row.status === "canceled" && <p className="text-sm text-ink-3">This campaign was canceled.</p>}

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
              <Ban aria-hidden className="size-4" /> Cancel campaign
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

// ── Per-recipient delivery log ─────────────────────────────────────────

const RECIPIENT_CHIP: Record<CampaignRecipientRow["status"], string> = {
  sent: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
  pending: "border-info/30 bg-info/10 text-info",
  failed: "border-alert/40 bg-alert/10 text-alert",
  skipped: "border-border bg-surface-2 text-ink-3",
};

function RecipientsPanel({ campaignId }: { campaignId: string }) {
  const [rows, setRows] = useState<CampaignRecipientRow[] | null>(null);
  const [loading, startLoad] = useTransition();

  function refresh() {
    startLoad(async () => {
      const r = await loadCampaignRecipients(campaignId);
      if (!r.ok) { toast.error(r.message); return; }
      setRows(r.data ?? []);
    });
  }

  return (
    <section className="space-y-3 rounded-xl glass-panel p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">Delivery log</h3>
        <Button onClick={refresh} disabled={loading} variant="outline" size="sm">
          <RefreshCw aria-hidden className={cn("size-3.5", loading && "animate-spin")} />
          {rows === null ? "Load" : "Refresh"}
        </Button>
      </div>

      {rows === null ? (
        <p className="text-sm text-ink-3">Load the per-recipient results.</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-ink-3">No recipients recorded.</p>
      ) : (
        <div className="max-h-80 space-y-1 overflow-y-auto">
          {rows.map((r) => (
            <div
              key={r.user_id}
              className="flex items-center justify-between gap-2 rounded-md border border-rule/50 bg-paper-sunken/30 px-2.5 py-1.5 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate text-ink">{r.display_name ?? r.email}</p>
                <p className="truncate text-xs text-ink-3">{r.email}{r.error ? ` · ${r.error}` : ""}</p>
              </div>
              <span
                className={cn(
                  "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                  RECIPIENT_CHIP[r.status],
                )}
              >
                {r.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Layout helpers ─────────────────────────────────────────────────────

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
