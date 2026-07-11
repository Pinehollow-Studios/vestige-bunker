"use client";

import { useState, useTransition } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  AUDIENCE_KINDS,
  AUDIENCE_LABELS,
  PRIVACY_OPTIONS,
  type BroadcastAudienceKind,
  type BroadcastTarget,
  type CountyOption,
  type UserPickRow,
} from "@/app/(dashboard)/notifications/types";

/**
 * The shared audience/targeting control — audience kind + filtered-cohort
 * filters + hand-picked individuals + optional app-version window. Extracted
 * from the push-broadcast editor so the email-campaign editor reuses exactly the
 * same targeting UX (the two audience models are identical server-side). The
 * individuals persistence + user search are injected so each surface points at
 * its own action.
 */

type Actionish<T = void> = { ok: true; data?: T } | { ok: false; message: string };

const SELECT_CLS =
  "flex h-9 w-full rounded-lg border border-input bg-paper-sunken/40 px-3 py-1 text-sm transition-colors focus-visible:border-brand/60 focus-visible:bg-paper-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30";

export function AudiencePicker({
  audienceKind,
  setAudienceKind,
  target,
  setTarget,
  minVersion,
  setMinVersion,
  maxVersion,
  setMaxVersion,
  counties,
  entityId,
  initialTargetUsers,
  onPersistTargets,
  onSearchUsers,
}: {
  audienceKind: BroadcastAudienceKind;
  setAudienceKind: (k: BroadcastAudienceKind) => void;
  target: BroadcastTarget;
  setTarget: (t: BroadcastTarget) => void;
  minVersion: string;
  setMinVersion: (v: string) => void;
  maxVersion: string;
  setMaxVersion: (v: string) => void;
  counties: CountyOption[];
  entityId: string;
  initialTargetUsers: UserPickRow[];
  onPersistTargets: (ids: string[]) => Promise<Actionish>;
  onSearchUsers: (query: string) => Promise<Actionish<UserPickRow[]>>;
}) {
  return (
    <div className="space-y-4">
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

      {audienceKind === "filtered" && (
        <FilteredCohort target={target} setTarget={setTarget} counties={counties} />
      )}
      {audienceKind === "individuals" && (
        <IndividualsPicker
          entityId={entityId}
          initialTargetUsers={initialTargetUsers}
          onPersistTargets={onPersistTargets}
          onSearchUsers={onSearchUsers}
        />
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
    </div>
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
  entityId,
  initialTargetUsers,
  onPersistTargets,
  onSearchUsers,
}: {
  entityId: string;
  initialTargetUsers: UserPickRow[];
  onPersistTargets: (ids: string[]) => Promise<Actionish>;
  onSearchUsers: (query: string) => Promise<Actionish<UserPickRow[]>>;
}) {
  void entityId;
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
      const r = await onSearchUsers(q);
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
      const r = await onPersistTargets(picked.map((p) => p.id));
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

// ── Layout helper ──────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
