"use client";

import { useMemo, useState, useTransition } from "react";
import { Ban, Clock, Send, ShieldCheck, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { AudiencePicker } from "@/components/admin/AudiencePicker";
import type { PickerUser } from "@/lib/users/roster";
import type { EmailStarter } from "@/lib/email/starters";
import { StarterPicker } from "./StarterPicker";
import { SendTestButton } from "./SendTestButton";
import {
  cancelCampaign,
  deleteCampaign,
  scheduleCampaign,
  sendCampaignNow,
  setCampaignTargets,
  updateCampaign,
} from "./campaigns/actions";
import {
  cancelWaitlist,
  deleteWaitlist,
  scheduleWaitlist,
  sendWaitlistNow,
  updateWaitlistCampaign,
} from "./waitlist/actions";
import { WaitlistTargetPicker } from "./waitlist/[id]/WaitlistTargetPicker";
import {
  STATUS_CHIP,
  STATUS_LABELS,
  type CampaignAudienceKind,
  type CampaignStatus,
  type CampaignTarget,
  type CountyOption,
} from "./campaigns/types";

export type ComposerAudience =
  | {
      kind: "app";
      audienceKind: CampaignAudienceKind;
      target: CampaignTarget;
      minVersion: string | null;
      maxVersion: string | null;
      bypass: boolean;
      allUsers: PickerUser[];
      initialSelectedIds: string[];
      counties: CountyOption[];
    }
  | {
      kind: "waitlist";
      audienceKind: "everyone" | "individuals";
      subscribedCount: number;
      initialTargets: string[];
    };

export type EmailComposerProps = {
  id: string;
  name: string;
  subject: string;
  preheader: string | null;
  html: string;
  status: CampaignStatus;
  scheduledAt: string | null;
  sentAt: string | null;
  sentCount: number;
  failedCount: number;
  recipientCount: number | null;
  isSuperAdmin: boolean;
  audience: ComposerAudience;
};

const TEXTAREA_CLS =
  "flex min-h-20 w-full rounded-lg border border-input bg-paper-sunken/40 px-3 py-2 text-sm transition-colors placeholder:text-ink-3 focus-visible:border-brand/60 focus-visible:bg-paper-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30";
const SELECT_CLS =
  "flex h-9 w-full rounded-lg border border-input bg-paper-sunken/40 px-3 py-1 text-sm transition-colors focus-visible:border-brand/60 focus-visible:bg-paper-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30";

const SAMPLE: Record<string, string> = {
  first_name: "Tom",
  unsubscribe_url: "https://vestige.golf/unsubscribe/sample",
};

function render(template: string, tokens: Record<string, string>): string {
  let out = template;
  for (const [key, value] of Object.entries(tokens)) out = out.split(`{{${key}}}`).join(value ?? "");
  return out.replace(/\{\{[a-zA-Z_]+\}\}/g, "");
}

export function EmailComposer(props: EmailComposerProps) {
  const { id, audience } = props;
  const isApp = audience.kind === "app";

  const [name, setName] = useState(props.name);
  const [subject, setSubject] = useState(props.subject);
  const [preheader, setPreheader] = useState(props.preheader ?? "");
  const [html, setHtml] = useState(props.html);

  // App audience state
  const [audienceKind, setAudienceKind] = useState<CampaignAudienceKind>(
    isApp ? audience.audienceKind : "everyone",
  );
  const [target, setTarget] = useState<CampaignTarget>(isApp ? audience.target : {});
  const [minVersion, setMinVersion] = useState(isApp ? audience.minVersion ?? "" : "");
  const [maxVersion, setMaxVersion] = useState(isApp ? audience.maxVersion ?? "" : "");
  const [bypass, setBypass] = useState(isApp ? audience.bypass : false);

  // Waitlist audience state
  const [wlKind, setWlKind] = useState<"everyone" | "individuals">(
    !isApp ? audience.audienceKind : "everyone",
  );
  const [wlTargetCount, setWlTargetCount] = useState(!isApp ? audience.initialTargets.length : 0);

  const [pending, startTransition] = useTransition();

  const isSent = props.status === "sent" || props.status === "sending";
  const isCanceled = props.status === "canceled";
  const editable = !isSent && !isCanceled;

  const previewHtml = useMemo(() => render(html, SAMPLE), [html]);

  function persist(): Promise<{ ok: boolean; message?: string }> {
    if (isApp) {
      return updateCampaign(id, {
        name,
        subject,
        preheader: preheader || null,
        html,
        bypass_marketing_consent: bypass,
        audience_kind: audienceKind,
        min_app_version: minVersion || null,
        max_app_version: maxVersion || null,
        target: audienceKind === "filtered" ? target : {},
      });
    }
    return updateWaitlistCampaign(id, {
      name,
      subject,
      preheader: preheader || null,
      html,
      audience_kind: wlKind,
    });
  }

  function saveDraft() {
    startTransition(async () => {
      const r = await persist();
      if (!r.ok) toast.error(r.message ?? "Couldn’t save.");
      else toast.success("Saved");
    });
  }

  function applyStarter(s: EmailStarter) {
    if ((html.trim() || subject.trim()) && !window.confirm(`Replace the current subject + content with “${s.name}”?`)) {
      return;
    }
    if (s.subject) setSubject(s.subject);
    if (s.preheader) setPreheader(s.preheader);
    setHtml(s.html);
    toast.success(`Started from “${s.name}”`);
  }

  function sendNow() {
    if (!subject.trim() || !html.trim()) {
      toast.error("Add a subject and content first.");
      return;
    }
    if (!isApp && wlKind === "individuals" && wlTargetCount === 0) {
      toast.error("Pick at least one subscriber, or switch to Everyone.");
      return;
    }
    const who = audienceDescription();
    const consent =
      isApp && !bypass ? " Opted-out members are excluded automatically." : "";
    if (!window.confirm(`Send this email to ${who} now?${consent} This can't be undone.`)) return;
    startTransition(async () => {
      const saved = await persist();
      if (!saved.ok) {
        toast.error(saved.message ?? "Couldn’t save before sending.");
        return;
      }
      const r = isApp ? await sendCampaignNow(id) : await sendWaitlistNow(id);
      if (!r.ok) toast.error(r.message);
      else toast.success(`Queued ${r.data ?? 0} ${r.data === 1 ? "recipient" : "recipients"}`);
    });
  }

  function audienceDescription(): string {
    if (isApp) {
      if (audienceKind === "everyone") return "all members";
      if (audienceKind === "individuals") return `${audience.initialSelectedIds.length} selected members`;
      return "the selected members";
    }
    if (wlKind === "everyone") return `all ${audience.kind === "waitlist" ? audience.subscribedCount.toLocaleString() : 0} subscribers`;
    return `${wlTargetCount.toLocaleString()} selected ${wlTargetCount === 1 ? "person" : "people"}`;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        {/* Who */}
        <Card title="Who gets it">
          <AudienceSection
            editable={editable}
            isApp={isApp}
            props={props}
            audienceKind={audienceKind}
            setAudienceKind={setAudienceKind}
            target={target}
            setTarget={setTarget}
            minVersion={minVersion}
            setMinVersion={setMinVersion}
            maxVersion={maxVersion}
            setMaxVersion={setMaxVersion}
            bypass={bypass}
            setBypass={setBypass}
            wlKind={wlKind}
            setWlKind={setWlKind}
            wlTargetCount={wlTargetCount}
            setWlTargetCount={setWlTargetCount}
            onPersistAppTargets={(ids) => setCampaignTargets(id, ids)}
          />
        </Card>

        {/* Write */}
        <Card title="Write">
          <Field label="Name" hint="Internal label — never shown to recipients.">
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={isCanceled} />
          </Field>

          {editable && <StarterPicker onPick={applyStarter} />}

          <Field label="Subject" hint="The subject line. {{first_name}} is filled per recipient.">
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} disabled={isCanceled} />
          </Field>
          <Field label="Preheader" hint="Optional preview line shown after the subject in most inboxes.">
            <Input value={preheader} onChange={(e) => setPreheader(e.target.value)} disabled={isCanceled} />
          </Field>

          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="Content" hint="Placeholders: {{first_name}}, {{unsubscribe_url}}.">
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

        {editable && (
          <Button onClick={saveDraft} disabled={pending} className="w-full">
            {pending ? "Saving…" : "Save changes"}
          </Button>
        )}
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <DeliveryCard
          props={props}
          pending={pending}
          editable={editable}
          isSent={isSent}
          audienceLine={audienceDescription()}
          subject={subject}
          html={html}
          preheader={preheader}
          onSendNow={sendNow}
        />
      </div>
    </div>
  );
}

// ── Audience ───────────────────────────────────────────────────────────

function AudienceSection({
  editable,
  isApp,
  props,
  audienceKind,
  setAudienceKind,
  target,
  setTarget,
  minVersion,
  setMinVersion,
  maxVersion,
  setMaxVersion,
  bypass,
  setBypass,
  wlKind,
  setWlKind,
  wlTargetCount,
  setWlTargetCount,
  onPersistAppTargets,
}: {
  editable: boolean;
  isApp: boolean;
  props: EmailComposerProps;
  audienceKind: CampaignAudienceKind;
  setAudienceKind: (k: CampaignAudienceKind) => void;
  target: CampaignTarget;
  setTarget: (t: CampaignTarget) => void;
  minVersion: string;
  setMinVersion: (v: string) => void;
  maxVersion: string;
  setMaxVersion: (v: string) => void;
  bypass: boolean;
  setBypass: (b: boolean) => void;
  wlKind: "everyone" | "individuals";
  setWlKind: (k: "everyone" | "individuals") => void;
  wlTargetCount: number;
  setWlTargetCount: (n: number) => void;
  onPersistAppTargets: (ids: string[]) => Promise<{ ok: true; data?: void } | { ok: false; message: string }>;
}) {
  const { audience } = props;

  const label = (
    <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-ink-2">
      <Users className="size-3.5" /> {isApp ? "App members" : "Waitlist"}
    </div>
  );

  if (!editable) {
    return (
      <div>
        {label}
        <p className="text-sm text-ink-2">
          {isApp
            ? props.audience.kind === "app"
              ? `Sent to ${props.audience.audienceKind}`
              : ""
            : wlKind === "everyone"
              ? "Sent to everyone on the list"
              : "Sent to selected people"}
        </p>
      </div>
    );
  }

  if (isApp && audience.kind === "app") {
    return (
      <div>
        {label}
        <AudiencePicker
          audienceKind={audienceKind}
          setAudienceKind={setAudienceKind}
          target={target}
          setTarget={setTarget}
          minVersion={minVersion}
          setMinVersion={setMinVersion}
          maxVersion={maxVersion}
          setMaxVersion={setMaxVersion}
          counties={audience.counties}
          allUsers={audience.allUsers}
          initialSelectedIds={audience.initialSelectedIds}
          showEmail
          onPersistTargets={onPersistAppTargets}
        />
        <label className="mt-3 flex items-start gap-2 rounded-lg border border-alert/30 bg-alert/5 p-2.5 text-sm text-ink-2">
          <input type="checkbox" checked={bypass} onChange={(e) => setBypass(e.target.checked)} className="mt-0.5" />
          <span>
            <span className="inline-flex items-center gap-1 font-medium text-alert">
              <ShieldCheck aria-hidden className="size-3.5" /> Service message
            </span>{" "}
            — bypass the marketing unsubscribe. Operational/account mail only.
          </span>
        </label>
      </div>
    );
  }

  if (!isApp && audience.kind === "waitlist") {
    return (
      <div>
        {label}
        <div className="grid grid-cols-2 gap-2">
          <AudienceOption active={wlKind === "everyone"} onClick={() => setWlKind("everyone")} title="Everyone" detail={`${audience.subscribedCount.toLocaleString()} subscribed`} />
          <AudienceOption active={wlKind === "individuals"} onClick={() => setWlKind("individuals")} title="Specific people" detail={wlTargetCount > 0 ? `${wlTargetCount} selected` : "pick from the list"} />
        </div>
        {wlKind === "individuals" && (
          <div className="pt-3">
            <WaitlistTargetPicker campaignId={props.id} initialSelected={audience.initialTargets} onCountChange={setWlTargetCount} />
          </div>
        )}
      </div>
    );
  }

  return label;
}

function AudienceOption({ active, onClick, title, detail }: { active: boolean; onClick: () => void; title: string; detail: string }) {
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

// ── Delivery sidebar ───────────────────────────────────────────────────

function DeliveryCard({
  props,
  pending,
  editable,
  isSent,
  audienceLine,
  subject,
  html,
  preheader,
  onSendNow,
}: {
  props: EmailComposerProps;
  pending: boolean;
  editable: boolean;
  isSent: boolean;
  audienceLine: string;
  subject: string;
  html: string;
  preheader: string;
  onSendNow: () => void;
}) {
  const { id, audience, isSuperAdmin, status } = props;
  const isApp = audience.kind === "app";
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
      const r = isApp ? await scheduleCampaign(id, iso) : await scheduleWaitlist(id, iso);
      if (!r.ok) toast.error(r.message);
      else toast.success("Scheduled");
    });
  }

  function cancel() {
    if (!window.confirm("Cancel this email? It won't be sent.")) return;
    startAction(async () => {
      const r = isApp ? await cancelCampaign(id) : await cancelWaitlist(id);
      if (!r.ok) toast.error(r.message);
      else toast.success("Canceled");
    });
  }

  function remove() {
    if (!window.confirm("Delete this email permanently?")) return;
    startAction(async () => {
      const r = isApp ? await deleteCampaign(id) : await deleteWaitlist(id);
      if (r && !r.ok) toast.error(r.message);
    });
  }

  return (
    <section className="space-y-3 rounded-xl glass-panel p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">Send</h3>
        <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", STATUS_CHIP[status])}>
          {STATUS_LABELS[status]}
        </span>
      </div>

      {editable && (
        <p className="flex items-start gap-1.5 text-sm text-ink-2">
          <Users aria-hidden className="mt-0.5 size-3.5 shrink-0 text-ink-3" />
          <span>Goes to <span className="font-medium text-ink">{audienceLine}</span></span>
        </p>
      )}
      {status === "sent" && (
        <p className="text-sm text-ink-2">
          Sent <span className="font-semibold tabular-nums text-ink">{props.sentCount}</span>
          {props.failedCount > 0 ? ` · ${props.failedCount} failed` : ""}
          {props.sentAt ? ` · ${new Date(props.sentAt).toLocaleString()}` : ""}
        </p>
      )}
      {status === "sending" && (
        <p className="text-sm text-ink-2">Sending… <span className="tabular-nums">{props.sentCount}</span>/{props.recipientCount ?? 0}</p>
      )}
      {status === "scheduled" && props.scheduledAt && (
        <p className="text-sm text-ink-2">Goes out {new Date(props.scheduledAt).toLocaleString()}</p>
      )}
      {status === "canceled" && <p className="text-sm text-ink-3">This email was canceled.</p>}

      {editable && (
        <>
          <SendTestButton subject={subject} html={html} preheader={preheader} />

          <Button onClick={onSendNow} disabled={busy} className="w-full bg-brand text-brand-fg hover:bg-brand-deep">
            <Send aria-hidden className="size-4" /> Send now
          </Button>

          <div className="space-y-1.5 rounded-lg border border-rule/70 bg-paper-sunken/30 p-3">
            <Label className="flex items-center gap-1.5 text-xs">
              <Clock aria-hidden className="size-3.5" /> Or schedule for later
            </Label>
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={SELECT_CLS} />
            <Button onClick={schedule} disabled={busy || !when} variant="outline" size="sm" className="w-full">
              {status === "scheduled" ? "Reschedule" : "Schedule"}
            </Button>
          </div>

          {status === "scheduled" && (
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
