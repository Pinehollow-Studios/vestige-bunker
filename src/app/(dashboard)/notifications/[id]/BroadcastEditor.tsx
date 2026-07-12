"use client";

import { useState, useTransition } from "react";
import { Ban, Clock, Pencil, Search, Send, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  cancelBroadcast,
  deleteBroadcast,
  editSentCopy,
  scheduleBroadcast,
  searchUsers,
  sendBroadcastNow,
  setBroadcastTargets,
  updateBroadcast,
  type BroadcastPatch,
} from "../actions";
import {
  AUDIENCE_KINDS,
  AUDIENCE_LABELS,
  PRIVACY_OPTIONS,
  STATUS_CHIP,
  STATUS_LABELS,
  type BroadcastAudienceKind,
  type BroadcastRow,
  type BroadcastTarget,
  type CountyOption,
  type UserPickRow,
} from "../types";
import { IOSNotification, VestigeInboxRow } from "../_components/previews";
import { SegmentAudiencePicker } from "@/components/admin/SegmentAudiencePicker";

const SELECT_CLS =
  "flex h-9 w-full rounded-lg border border-input bg-paper-sunken/40 px-3 py-1 text-sm transition-colors focus-visible:border-brand/60 focus-visible:bg-paper-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30";
const TEXTAREA_CLS =
  "flex min-h-20 w-full rounded-lg border border-input bg-paper-sunken/40 px-3 py-2 text-sm transition-colors placeholder:text-ink-3 focus-visible:border-brand/60 focus-visible:bg-paper-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30";

export function BroadcastEditor({
  row,
  initialTargetUsers,
  counties,
  isSuperAdmin,
}: {
  row: BroadcastRow;
  initialTargetUsers: UserPickRow[];
  counties: CountyOption[];
  isSuperAdmin: boolean;
}) {
  const [title, setTitle] = useState(row.title);
  const [body, setBody] = useState(row.body);
  const [destinationURL, setDestinationURL] = useState(row.destination_url ?? "");
  const [isCritical, setIsCritical] = useState(row.is_critical);
  const [audienceKind, setAudienceKind] = useState<BroadcastAudienceKind>(row.audience_kind);
  const [minVersion, setMinVersion] = useState(row.min_app_version ?? "");
  const [maxVersion, setMaxVersion] = useState(row.max_app_version ?? "");
  const [target, setTarget] = useState<BroadcastTarget>(row.target ?? {});

  const [pending, startTransition] = useTransition();

  const isSent = row.status === "sent" || row.status === "sending";
  const isCanceled = row.status === "canceled";
  const editable = !isSent && !isCanceled;

  const patch: BroadcastPatch = {
    title,
    body,
    destination_url: destinationURL || null,
    is_critical: isCritical,
    audience_kind: audienceKind,
    min_app_version: minVersion || null,
    max_app_version: maxVersion || null,
    target: audienceKind === "filtered" || audienceKind === "segment" ? target : {},
  };

  function saveDraft() {
    startTransition(async () => {
      const r = await updateBroadcast(row.id, patch);
      if (!r.ok) toast.error(r.message);
      else toast.success("Saved");
    });
  }

  function sendNow() {
    if (!title.trim() || !body.trim()) {
      toast.error("Add a title and body first.");
      return;
    }
    const who = audienceKind === "everyone" ? "everyone" : "the selected audience";
    if (!window.confirm(`Send this push to ${who} now? This can't be undone.`)) return;
    startTransition(async () => {
      // Persist any unsaved edits first so the delivered copy is current.
      const saved = await updateBroadcast(row.id, patch);
      if (!saved.ok) {
        toast.error(saved.message);
        return;
      }
      const r = await sendBroadcastNow(row.id);
      if (!r.ok) toast.error(r.message);
      else toast.success(`Sent to ${r.data ?? 0} ${r.data === 1 ? "person" : "people"}`);
    });
  }

  function updateSentCopy() {
    startTransition(async () => {
      const r = await editSentCopy(row.id, title, body, destinationURL || null);
      if (!r.ok) toast.error(r.message);
      else toast.success(`Updated ${r.data ?? 0} inbox ${r.data === 1 ? "row" : "rows"}`);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      {/* Sticky preview + delivery */}
      <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">On the lock screen</p>
          <IOSNotification title={title} body={body} />
        </div>
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">In the app</p>
          <VestigeInboxRow title={title} body={body} icon={<Send className="size-4" />} />
        </div>
        <p className="text-xs text-ink-3">
          {destinationURL ? `Tap → ${destinationURL}` : "Tap → opens the inbox"}
        </p>
        <DeliveryCard
          row={row}
          pending={pending}
          editable={editable}
          isSent={isSent}
          isSuperAdmin={isSuperAdmin}
          onSendNow={sendNow}
        />
      </div>

      {/* Form */}
      <div className="space-y-6">
        <Card title="Message">
          <Field label="Title" hint="The push headline + inbox title.">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={isCanceled} />
          </Field>
          <Field label="Body" hint="The push + inbox message.">
            <textarea
              className={TEXTAREA_CLS}
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={isCanceled}
            />
          </Field>
          <Field label="Tap destination" hint="Optional deep link or web URL. Blank → opens the inbox.">
            <Input
              value={destinationURL}
              onChange={(e) => setDestinationURL(e.target.value)}
              placeholder="vestige://course/<id> · https://vestige.golf/… · https://…"
              disabled={isCanceled}
            />
          </Field>
          {editable && (
            <label className="flex items-start gap-2 rounded-lg border border-alert/30 bg-alert/5 p-2.5 text-sm text-ink-2">
              <input
                type="checkbox"
                checked={isCritical}
                onChange={(e) => setIsCritical(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="inline-flex items-center gap-1 font-medium text-alert">
                  <Zap aria-hidden className="size-3.5" /> Critical
                </span>{" "}
                - bypass the user&apos;s &ldquo;Announcements&rdquo; opt-out. Service messages only.
              </span>
            </label>
          )}
        </Card>

        {editable ? (
          <Card title="Who gets it">
            <Field label="Audience">
              <select
                className={SELECT_CLS}
                value={audienceKind}
                onChange={(e) => setAudienceKind(e.target.value as BroadcastAudienceKind)}
              >
                {AUDIENCE_KINDS.map((a) => (
                  <option key={a} value={a}>{AUDIENCE_LABELS[a]}</option>
                ))}
              </select>
            </Field>

            {audienceKind === "segment" && <SegmentAudiencePicker target={target} setTarget={setTarget} />}
            {audienceKind === "filtered" && (
              <FilteredCohort target={target} setTarget={setTarget} counties={counties} />
            )}
            {audienceKind === "individuals" && (
              <IndividualsPicker broadcastId={row.id} initialTargetUsers={initialTargetUsers} />
            )}

            <div className="space-y-2 rounded-lg border border-rule/70 bg-paper-sunken/30 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">
                App-version window (optional)
              </p>
              <p className="text-xs text-muted-foreground/80">
                Applied on top of the audience, against each user&apos;s last-seen version. Marketing versions like 0.2.4.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Minimum version">
                  <Input value={minVersion} onChange={(e) => setMinVersion(e.target.value)} placeholder="0.2.4" />
                </Field>
                <Field label="Maximum version">
                  <Input value={maxVersion} onChange={(e) => setMaxVersion(e.target.value)} placeholder="" />
                </Field>
              </div>
            </div>
          </Card>
        ) : (
          <Card title="Who got it">
            <p className="text-sm text-ink-2">
              {AUDIENCE_LABELS[row.audience_kind]}
              {row.recipient_count != null && row.status === "sent"
                ? ` · ${row.recipient_count} ${row.recipient_count === 1 ? "person" : "people"} reached`
                : ""}
            </p>
          </Card>
        )}

        {editable && (
          <Button onClick={saveDraft} disabled={pending} className="w-full">
            {pending ? "Saving…" : "Save changes"}
          </Button>
        )}
        {isSent && (
          <Button onClick={updateSentCopy} disabled={pending} variant="outline" className="w-full">
            <Pencil aria-hidden className="size-4" />
            {pending ? "Updating…" : "Update in-app copy"}
          </Button>
        )}
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
  row: BroadcastRow;
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
      const r = await scheduleBroadcast(row.id, iso);
      if (!r.ok) toast.error(r.message);
      else toast.success("Scheduled");
    });
  }

  function cancel() {
    if (!window.confirm("Cancel this broadcast? It won't be sent.")) return;
    startAction(async () => {
      const r = await cancelBroadcast(row.id);
      if (!r.ok) toast.error(r.message);
      else toast.success("Canceled");
    });
  }

  function remove() {
    if (!window.confirm("Delete this broadcast permanently?")) return;
    startAction(async () => {
      const r = await deleteBroadcast(row.id);
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
          Reached <span className="font-semibold tabular-nums text-ink">{row.recipient_count ?? 0}</span>
          {row.sent_at ? ` · ${new Date(row.sent_at).toLocaleString()}` : ""}
        </p>
      )}
      {row.status === "scheduled" && row.scheduled_at && (
        <p className="text-sm text-ink-2">Goes out {new Date(row.scheduled_at).toLocaleString()}</p>
      )}
      {row.status === "canceled" && <p className="text-sm text-ink-3">This broadcast was canceled.</p>}

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
              <Ban aria-hidden className="size-4" /> Cancel broadcast
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

// ── Targeting: filtered cohort ─────────────────────────────────────────

function FilteredCohort({
  target,
  setTarget,
  counties,
}: {
  target: BroadcastTarget;
  setTarget: (t: BroadcastTarget) => void;
  counties: CountyOption[];
}) {
  const countyName: Record<string, string> = {};
  for (const c of counties) countyName[c.id] = c.name;
  const selectedCounties = target.home_county_ids ?? [];

  function patch(next: Partial<BroadcastTarget>) {
    setTarget({ ...target, ...next });
  }
  function toggleCounty(id: string) {
    const has = selectedCounties.includes(id);
    const next = has ? selectedCounties.filter((c) => c !== id) : [...selectedCounties, id];
    patch({ home_county_ids: next.length ? next : undefined });
  }
  function togglePrivacy(value: string) {
    const current = target.privacy_in ?? [];
    const has = current.includes(value);
    const next = has ? current.filter((p) => p !== value) : [...current, value];
    patch({ privacy_in: next.length ? next : undefined });
  }

  return (
    <div className="space-y-3 rounded-lg border border-rule/70 bg-paper-sunken/30 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">
        Cohort filters - all conditions must match
      </p>

      <TristateRow label="Founding member" value={target.is_founding_member} onChange={(v) => patch({ is_founding_member: v })} />
      <TristateRow label="Has logged a round" value={target.has_logged_round} onChange={(v) => patch({ has_logged_round: v })} />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Joined after">
          <Input type="date" value={target.joined_after ?? ""} onChange={(e) => patch({ joined_after: e.target.value || undefined })} />
        </Field>
        <Field label="Joined before">
          <Input type="date" value={target.joined_before ?? ""} onChange={(e) => patch({ joined_before: e.target.value || undefined })} />
        </Field>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Privacy</Label>
        <div className="flex flex-wrap gap-1.5">
          {PRIVACY_OPTIONS.map((p) => {
            const active = (target.privacy_in ?? []).includes(p.value);
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => togglePrivacy(p.value)}
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition",
                  active
                    ? "border-brand/40 bg-brand/10 text-brand ring-2 ring-brand/40"
                    : "border-rule/70 bg-paper-sunken/60 text-ink-2 hover:border-brand/30",
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Home counties</Label>
        {selectedCounties.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selectedCounties.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => toggleCounty(id)}
                className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 text-xs text-brand transition-colors hover:border-alert/40 hover:bg-alert/10 hover:text-alert"
              >
                {countyName[id] ?? "county"}
                <span aria-hidden>×</span>
              </button>
            ))}
          </div>
        )}
        <select className={SELECT_CLS} value="" onChange={(e) => { if (e.target.value) toggleCounty(e.target.value); }}>
          <option value="">Add a county…</option>
          {counties.filter((c) => !selectedCounties.includes(c.id)).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function TristateRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | undefined;
  onChange: (v: boolean | undefined) => void;
}) {
  const options: { v: boolean | undefined; l: string }[] = [
    { v: undefined, l: "Any" },
    { v: true, l: "Yes" },
    { v: false, l: "No" },
  ];
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-1">
        {options.map((o) => {
          const active = value === o.v;
          return (
            <button
              key={o.l}
              type="button"
              onClick={() => onChange(o.v)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition",
                active
                  ? "border-brand/40 bg-brand/10 text-brand ring-1 ring-brand/40"
                  : "border-rule/70 bg-paper-sunken/60 text-ink-2 hover:border-brand/30",
              )}
            >
              {o.l}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Targeting: individuals ─────────────────────────────────────────────

function IndividualsPicker({
  broadcastId,
  initialTargetUsers,
}: {
  broadcastId: string;
  initialTargetUsers: UserPickRow[];
}) {
  const [picked, setPicked] = useState<UserPickRow[]>(initialTargetUsers);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserPickRow[]>([]);
  const [searching, startSearch] = useTransition();
  const [saving, startSave] = useTransition();

  function runSearch() {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    startSearch(async () => {
      const r = await searchUsers(q);
      if (!r.ok) { toast.error(r.message); return; }
      setResults(r.data ?? []);
    });
  }

  function add(user: UserPickRow) {
    if (picked.some((p) => p.id === user.id)) return;
    setPicked([...picked, user]);
  }
  function remove(id: string) {
    setPicked(picked.filter((p) => p.id !== id));
  }
  function persist() {
    startSave(async () => {
      const r = await setBroadcastTargets(broadcastId, picked.map((p) => p.id));
      if (!r.ok) toast.error(r.message);
      else toast.success(`Saved ${picked.length} ${picked.length === 1 ? "person" : "people"}`);
    });
  }
  function userLabel(u: UserPickRow): string {
    return u.display_name ?? (u.username ? `@${u.username}` : u.id.slice(0, 8));
  }

  return (
    <div className="space-y-3 rounded-lg border border-rule/70 bg-paper-sunken/30 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">Hand-picked recipients</p>

      {picked.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {picked.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => remove(u.id)}
              className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 text-xs text-brand transition-colors hover:border-alert/40 hover:bg-alert/10 hover:text-alert"
            >
              {userLabel(u)}
              <span aria-hidden>×</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 rounded-lg border border-rule/70 bg-paper-sunken/40 px-3 py-1.5">
        <Search aria-hidden className="size-3.5 text-ink-3" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); runSearch(); } }}
          placeholder="Search username or display name…"
          className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-3 focus:outline-none"
        />
        <button
          type="button"
          onClick={runSearch}
          disabled={searching || query.trim().length < 2}
          className="rounded-md bg-brand px-2.5 py-1 text-[11px] font-semibold text-brand-fg disabled:opacity-60"
        >
          Search
        </button>
      </div>

      {results.length > 0 && (
        <div className="space-y-1">
          {results.map((u) => {
            const already = picked.some((p) => p.id === u.id);
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => add(u)}
                disabled={already}
                className="flex w-full items-center justify-between rounded-md border border-rule/60 bg-paper-sunken/40 px-2.5 py-1.5 text-left text-sm transition-colors hover:border-brand/30 disabled:opacity-50"
              >
                <span className="text-ink">{userLabel(u)}</span>
                <span className="text-xs text-ink-3">{already ? "Added" : "+ Add"}</span>
              </button>
            );
          })}
        </div>
      )}

      <Button onClick={persist} disabled={saving} variant="outline" size="sm" className="w-full">
        {saving ? "Saving…" : `Save ${picked.length} ${picked.length === 1 ? "recipient" : "recipients"}`}
      </Button>
    </div>
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
