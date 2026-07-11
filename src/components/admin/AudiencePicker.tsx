"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { PickerUser } from "@/lib/users/roster";
import {
  AUDIENCE_KINDS,
  AUDIENCE_LABELS,
  PRIVACY_OPTIONS,
  type BroadcastAudienceKind,
  type BroadcastTarget,
  type CountyOption,
} from "@/app/(dashboard)/notifications/types";

/**
 * The shared audience/targeting control — audience kind + filtered-cohort
 * filters + hand-picked individuals + optional app-version window. Extracted
 * from the push-broadcast editor so the email-campaign editor reuses exactly the
 * same targeting UX. The individuals picker browses the FULL roster (loaded by
 * the caller) with a live filter, per-row selection feedback, and — for email —
 * each user's address, so you can see exactly who you're sending to.
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
  allUsers,
  initialSelectedIds,
  showEmail = false,
  onPersistTargets,
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
  allUsers: PickerUser[];
  initialSelectedIds: string[];
  showEmail?: boolean;
  onPersistTargets: (ids: string[]) => Promise<Actionish>;
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
          allUsers={allUsers}
          initialSelectedIds={initialSelectedIds}
          showEmail={showEmail}
          onPersistTargets={onPersistTargets}
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

// ── Targeting: individuals (browse the full roster) ────────────────────

function IndividualsPicker({
  allUsers,
  initialSelectedIds,
  showEmail,
  onPersistTargets,
}: {
  allUsers: PickerUser[];
  initialSelectedIds: string[];
  showEmail: boolean;
  onPersistTargets: (ids: string[]) => Promise<Actionish>;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialSelectedIds));
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set(initialSelectedIds));
  const [filter, setFilter] = useState("");
  const [justSaved, setJustSaved] = useState(false);
  const [saving, startSave] = useTransition();

  const byId = useMemo(() => {
    const m = new Map<string, PickerUser>();
    for (const u of allUsers) m.set(u.id, u);
    return m;
  }, [allUsers]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return allUsers;
    return allUsers.filter(
      (u) =>
        (u.display_name ?? "").toLowerCase().includes(q) ||
        (u.username ?? "").toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q),
    );
  }, [allUsers, filter]);

  const dirty = useMemo(() => !setsEqual(selected, savedIds), [selected, savedIds]);

  function toggle(id: string) {
    setJustSaved(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function save() {
    startSave(async () => {
      const r = await onPersistTargets([...selected]);
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      setSavedIds(new Set(selected));
      setJustSaved(true);
      toast.success(`Saved ${selected.size} ${selected.size === 1 ? "recipient" : "recipients"}`);
    });
  }

  const selectedUsers = [...selected].map((id) => byId.get(id)).filter(Boolean) as PickerUser[];

  return (
    <div className="space-y-3 rounded-lg border border-rule/70 bg-paper-sunken/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">Hand-picked recipients</p>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
            selected.size > 0
              ? "border-brand/40 bg-brand/10 text-brand"
              : "border-rule/70 bg-paper-sunken/60 text-ink-3",
          )}
        >
          <Users className="size-3" />
          {selected.size} selected
        </span>
      </div>

      {/* Selected summary — always visible, even while filtering. */}
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedUsers.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => toggle(u.id)}
              title="Remove"
              className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 text-xs text-brand transition-colors hover:border-alert/40 hover:bg-alert/10 hover:text-alert"
            >
              {userLabel(u)}
              <span aria-hidden>×</span>
            </button>
          ))}
        </div>
      )}

      {/* Filter. */}
      <div className="flex items-center gap-2 rounded-lg border border-rule/70 bg-paper-sunken/40 px-3 py-1.5">
        <Search aria-hidden className="size-3.5 text-ink-3" />
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={showEmail ? "Filter by name, username or email…" : "Filter by name or username…"}
          className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-3 focus:outline-none"
        />
        {filter && (
          <button type="button" onClick={() => setFilter("")} className="text-ink-3 hover:text-ink-2" aria-label="Clear filter">
            ×
          </button>
        )}
      </div>

      {/* Roster list. */}
      <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-rule/50 bg-paper-raised/40 p-1">
        {allUsers.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-ink-3">No users to pick from.</p>
        ) : filtered.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-ink-3">No matches for “{filter}”.</p>
        ) : (
          filtered.map((u) => {
            const isSelected = selected.has(u.id);
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => toggle(u.id)}
                aria-pressed={isSelected}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md border px-2.5 py-2 text-left transition-colors",
                  isSelected
                    ? "border-brand/40 bg-brand/10"
                    : "border-transparent hover:border-rule/60 hover:bg-paper-sunken/50",
                )}
              >
                <Avatar user={u} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{userLabel(u)}</p>
                  <p className="truncate text-xs text-ink-3">
                    {u.username ? `@${u.username}` : u.id.slice(0, 8)}
                    {showEmail && u.email ? ` · ${u.email}` : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                    isSelected ? "border-brand bg-brand text-brand-fg" : "border-rule/70 bg-transparent",
                  )}
                >
                  {isSelected && <Check className="size-3.5" />}
                </span>
              </button>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-ink-3">
          {selected.size > 0
            ? `${selected.size} of ${allUsers.length} selected`
            : `Pick from ${allUsers.length} ${allUsers.length === 1 ? "user" : "users"}`}
        </span>
        <Button onClick={save} disabled={saving || !dirty} size="sm" variant={dirty ? "default" : "outline"}>
          {saving ? "Saving…" : dirty ? "Save recipients" : justSaved ? (
            <><Check className="size-4" /> Saved</>
          ) : "Saved"}
        </Button>
      </div>
    </div>
  );
}

function Avatar({ user }: { user: PickerUser }) {
  if (user.avatar_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={user.avatar_url} alt="" className="size-8 shrink-0 rounded-full object-cover" />;
  }
  const label = user.display_name ?? user.username ?? "?";
  const initials = label.trim().slice(0, 1).toUpperCase() || "?";
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand/15 text-xs font-semibold text-brand">
      {initials}
    </span>
  );
}

function userLabel(u: PickerUser): string {
  return u.display_name ?? (u.username ? `@${u.username}` : u.id.slice(0, 8));
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
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

// ── Layout helper ──────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
