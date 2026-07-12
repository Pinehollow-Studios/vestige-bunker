"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, SlidersHorizontal, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { AudiencePicker } from "@/components/admin/AudiencePicker";
import type { CountyOption } from "@/app/(dashboard)/notifications/types";
import type { PickerUser } from "@/lib/users/roster";
import { cn } from "@/lib/utils";
import {
  deleteFlag,
  fetchFlagReach,
  setFlagArchived,
  setFlagEnabled,
  setFlagTargets,
  upsertFlag,
  type UpsertFlagInput,
} from "./actions";
import {
  CATEGORY_BLURB,
  defaultValueFor,
  flagCategory,
  FLAG_CATEGORIES,
  humanizeKey,
  isFeature,
  kindLabel,
  relativeTime,
  valueSummary,
  VALUE_TYPE_LABELS,
  VALUE_TYPES,
  whoSummary,
  type BroadcastAudienceKind,
  type BroadcastTarget,
  type FlagRow,
  type FlagValueType,
} from "./types";

// ── Board ──────────────────────────────────────────────────────────────

export function FlagsBoard({
  flags,
  counties,
  allUsers,
  targetsByFlag,
}: {
  flags: FlagRow[];
  counties: CountyOption[];
  allUsers: PickerUser[];
  targetsByFlag: Record<string, string[]>;
}) {
  const live = flags.filter((f) => !f.archived);
  const on = live.filter((f) => f.enabled);
  const off = live.filter((f) => !f.enabled);
  const archived = flags.filter((f) => f.archived);
  const [showArchived, setShowArchived] = useState(false);

  const card = (flag: FlagRow) => (
    <FlagCard
      key={flag.key}
      flag={flag}
      counties={counties}
      allUsers={allUsers}
      initialTargetIds={targetsByFlag[flag.key] ?? []}
    />
  );

  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-ink-2">
        Switch features on or off and change settings — live, without shipping an app update.
      </p>

      {/* What's on right now. */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl glass-panel px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-3">On now</span>
        {on.length === 0 ? (
          <span className="text-sm text-ink-3">Nothing is switched on.</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {on.map((f) => (
              <span
                key={f.key}
                className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand"
              >
                <span className="size-1.5 rounded-full bg-brand" />
                {humanizeKey(f.key)}
              </span>
            ))}
          </div>
        )}
        <span className="ml-auto text-xs tabular-nums text-ink-3">
          {on.length} on · {off.length} off
        </span>
      </div>

      <NewFlagPanel existingKeys={new Set(flags.map((f) => f.key))} />

      {live.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-paper-raised/50 p-6 text-center text-sm text-ink-3">
          Nothing here yet. Add a feature or setting above.
        </div>
      ) : (
        FLAG_CATEGORIES.map((category) => {
          // Within a category, show what's on first.
          const items = live
            .filter((f) => flagCategory(f.value_type) === category)
            .sort((a, b) => Number(b.enabled) - Number(a.enabled));
          if (items.length === 0) return null;
          return (
            <Group key={category} title={category} blurb={CATEGORY_BLURB[category]} count={items.length}>
              {items.map(card)}
            </Group>
          );
        })
      )}

      {archived.length > 0 && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowArchived((s) => !s)}
            className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-3 hover:text-ink-2"
          >
            <ChevronDown className={cn("size-3.5 transition-transform", showArchived && "rotate-180")} />
            Archived ({archived.length})
          </button>
          {showArchived && <div className="space-y-3">{archived.map(card)}</div>}
        </div>
      )}
    </div>
  );
}

function Group({
  title,
  count,
  blurb,
  children,
}: {
  title: string;
  count: number;
  blurb?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-3">
          {title}
          <span className="rounded-full bg-paper-sunken/70 px-1.5 py-px text-[10px] tabular-nums text-ink-3">
            {count}
          </span>
        </h2>
        {blurb && <span className="text-xs text-ink-3">{blurb}</span>}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

// ── New flag ───────────────────────────────────────────────────────────

function NewFlagPanel({ existingKeys }: { existingKeys: Set<string> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [valueType, setValueType] = useState<FlagValueType>("boolean");
  const [description, setDescription] = useState("");
  const [pending, start] = useTransition();

  function reset() {
    setKey("");
    setValueType("boolean");
    setDescription("");
    setOpen(false);
  }

  function create() {
    const trimmed = key.trim();
    if (!/^[a-z][a-z0-9_]*$/.test(trimmed)) {
      toast.error("The ID needs lowercase letters, numbers and underscores, e.g. new_home_hero");
      return;
    }
    if (existingKeys.has(trimmed)) {
      toast.error("Something with that ID already exists");
      return;
    }
    start(async () => {
      const r = await upsertFlag({
        key: trimmed,
        description: description.trim(),
        value_type: valueType,
        value: defaultValueFor(valueType),
        enabled: false,
        rollout_percentage: 100,
        audience_kind: "everyone",
        target: {},
        min_app_version: null,
        max_app_version: null,
      });
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      toast.success("Added — it starts off. Turn it on when you're ready.");
      reset();
      router.refresh();
    });
  }

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Add a feature or setting
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-xl glass-panel p-4">
      <FieldLabel label="Type">
        <select
          className={SELECT_CLS}
          value={valueType}
          onChange={(e) => setValueType(e.target.value as FlagValueType)}
        >
          {VALUE_TYPES.map((t) => (
            <option key={t} value={t}>
              {VALUE_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </FieldLabel>
      <FieldLabel label="ID" hint="What the app looks up. Lowercase, underscores — matches the app code.">
        <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="new_home_hero" />
      </FieldLabel>
      <FieldLabel label="What it controls" hint="A plain note for the team.">
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="The redesigned Home hero"
        />
      </FieldLabel>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={reset} disabled={pending}>
          Cancel
        </Button>
        <Button onClick={create} disabled={pending || !key.trim()}>
          {pending ? "Adding…" : "Add"}
        </Button>
      </div>
    </div>
  );
}

// ── Flag card ──────────────────────────────────────────────────────────

function FlagCard({
  flag,
  counties,
  allUsers,
  initialTargetIds,
}: {
  flag: FlagRow;
  counties: CountyOption[];
  allUsers: PickerUser[];
  initialTargetIds: string[];
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [enabled, setEnabled] = useState(flag.enabled);
  const [toggling, startToggle] = useTransition();

  const feature = isFeature(flag.value_type);

  function toggle() {
    const next = !enabled;
    setEnabled(next); // optimistic
    startToggle(async () => {
      const r = await setFlagEnabled(flag.key, next);
      if (!r.ok) {
        setEnabled(!next);
        toast.error(r.message);
        return;
      }
      toast.success(next ? "Turned on" : "Turned off");
      router.refresh();
    });
  }

  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-colors",
        flag.archived
          ? "border-border bg-paper-raised/40 opacity-70"
          : enabled
            ? "border-brand/30 bg-brand/[0.04]"
            : "border-border bg-paper-raised/50",
      )}
    >
      <div className="flex items-start gap-3.5">
        <Toggle on={enabled} busy={toggling} onClick={toggle} disabled={flag.archived} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-ink">{humanizeKey(flag.key)}</span>
            <span
              className={cn(
                "rounded-full px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide",
                feature ? "bg-info/10 text-info" : "bg-amber/10 text-amber",
              )}
            >
              {kindLabel(flag.value_type)}
            </span>
          </div>
          {flag.description && <p className="mt-0.5 text-sm text-ink-2">{flag.description}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-ink-3">
            {!feature && (
              <>
                <span>
                  Set to <span className="font-medium text-ink-2">{valueSummary(flag)}</span>
                </span>
                <span aria-hidden>·</span>
              </>
            )}
            <span>{whoSummary(flag)}</span>
            <span aria-hidden>·</span>
            <code className="font-mono text-[11px] text-ink-3">{flag.key}</code>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setExpanded((e) => !e)}>
          <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} />
          {expanded ? "Close" : "Edit"}
        </Button>
      </div>

      {expanded && (
        <FlagEditor
          flag={flag}
          counties={counties}
          allUsers={allUsers}
          initialTargetIds={initialTargetIds}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  );
}

// ── Editor ─────────────────────────────────────────────────────────────

function FlagEditor({
  flag,
  counties,
  allUsers,
  initialTargetIds,
  onSaved,
}: {
  flag: FlagRow;
  counties: CountyOption[];
  allUsers: PickerUser[];
  initialTargetIds: string[];
  onSaved: () => void;
}) {
  const feature = isFeature(flag.value_type);
  const [description, setDescription] = useState(flag.description);
  const [value, setValue] = useState<unknown>(flag.value);
  const [jsonText, setJsonText] = useState(
    flag.value_type === "json" ? JSON.stringify(flag.value ?? {}, null, 2) : "",
  );
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [rollout, setRollout] = useState(flag.rollout_percentage);
  const [audienceKind, setAudienceKind] = useState<BroadcastAudienceKind>(flag.audience_kind);
  const [target, setTarget] = useState<BroadcastTarget>(flag.target ?? {});
  const [minVersion, setMinVersion] = useState(flag.min_app_version ?? "");
  const [maxVersion, setMaxVersion] = useState(flag.max_app_version ?? "");
  const [showAdvanced, setShowAdvanced] = useState(
    flag.rollout_percentage < 100 || flag.audience_kind !== "everyone",
  );

  const [saving, startSave] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reach, setReach] = useState<number | null>(null);
  const [reaching, startReach] = useTransition();

  function committedValue(): { ok: true; value: unknown } | { ok: false } {
    if (feature) return { ok: true, value: true };
    if (flag.value_type === "json") {
      try {
        const parsed = JSON.parse(jsonText);
        setJsonError(null);
        return { ok: true, value: parsed };
      } catch {
        setJsonError("This isn't valid JSON yet");
        return { ok: false };
      }
    }
    return { ok: true, value };
  }

  function save() {
    const committed = committedValue();
    if (!committed.ok) {
      toast.error("Fix the value first");
      return;
    }
    const input: UpsertFlagInput = {
      key: flag.key,
      description: description.trim(),
      value_type: flag.value_type,
      value: committed.value,
      enabled: flag.enabled,
      rollout_percentage: rollout,
      audience_kind: audienceKind,
      target: audienceKind === "filtered" ? target : {},
      min_app_version: minVersion || null,
      max_app_version: maxVersion || null,
    };
    startSave(async () => {
      const r = await upsertFlag(input);
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      toast.success("Saved");
      onSaved();
    });
  }

  function checkReach() {
    startReach(async () => {
      const r = await fetchFlagReach(flag.key);
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      setReach(r.data ?? 0);
    });
  }

  function toggleArchive() {
    startSave(async () => {
      const r = await setFlagArchived(flag.key, !flag.archived);
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      toast.success(flag.archived ? "Restored" : "Archived");
      onSaved();
    });
  }

  function doDelete() {
    startSave(async () => {
      const r = await deleteFlag(flag.key);
      setConfirmDelete(false);
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      toast.success("Deleted");
      onSaved();
    });
  }

  return (
    <div className="mt-4 space-y-4 border-t border-rule/60 pt-4">
      <FieldLabel label="What it controls">
        <Input value={description} onChange={(e) => setDescription(e.target.value)} />
      </FieldLabel>

      {/* Value — settings only (a feature is simply on/off). */}
      {!feature && (
        <div className="space-y-1.5">
          <Label className="text-xs">Value people get when this is on</Label>
          <ValueEditor
            valueType={flag.value_type}
            value={value}
            setValue={setValue}
            jsonText={jsonText}
            setJsonText={(t) => {
              setJsonText(t);
              setJsonError(null);
            }}
            jsonError={jsonError}
          />
        </div>
      )}

      {/* Advanced: gradual rollout + who. Collapsed by default. */}
      <div className="rounded-lg border border-rule/60 bg-paper-sunken/20">
        <button
          type="button"
          onClick={() => setShowAdvanced((s) => !s)}
          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-ink-2 hover:text-ink"
        >
          <SlidersHorizontal className="size-3.5 text-ink-3" />
          <span className="font-medium">Roll out gradually or limit who sees it</span>
          <span className="ml-auto text-xs text-ink-3">{whoSummary({ audience_kind: audienceKind, target_user_count: initialTargetIds.length, rollout_percentage: rollout })}</span>
          <ChevronDown className={cn("size-4 text-ink-3 transition-transform", showAdvanced && "rotate-180")} />
        </button>

        {showAdvanced && (
          <div className="space-y-4 border-t border-rule/50 p-3">
            {/* Percentage. */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Show to a percentage of people</Label>
                <span className="font-mono text-sm tabular-nums text-ink">{rollout}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={rollout}
                onChange={(e) => setRollout(Number(e.target.value))}
                className="w-full accent-brand"
              />
              <div className="flex gap-1.5">
                {[10, 25, 50, 100].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setRollout(p)}
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition",
                      rollout === p
                        ? "border-brand/40 bg-brand/10 text-brand"
                        : "border-rule/70 bg-paper-sunken/60 text-ink-2 hover:border-brand/30",
                    )}
                  >
                    {p === 100 ? "Everyone" : `${p}%`}
                  </button>
                ))}
              </div>
              <p className="text-xs text-ink-3">
                The same people stay in as you raise it — nobody flickers in and out.
              </p>
            </div>

            {/* Who (shared control). */}
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
              allUsers={allUsers}
              initialSelectedIds={initialTargetIds}
              onPersistTargets={(ids) => setFlagTargets(flag.key, ids)}
            />
          </div>
        )}
      </div>

      {/* Actions. */}
      <div className="flex flex-wrap items-center gap-2 border-t border-rule/60 pt-3">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button variant="outline" size="sm" onClick={checkReach} disabled={reaching}>
          <Users className="size-4" />
          {reaching ? "Checking…" : reach !== null ? `${reach} affected` : "How many people?"}
        </Button>
        <span className="ml-auto text-xs text-ink-3">Changed {relativeTime(flag.updated_at)}</span>
        <Button variant="ghost" size="sm" onClick={toggleArchive} disabled={saving}>
          {flag.archived ? "Restore" : "Archive"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirmDelete(true)}
          disabled={saving}
          className="text-alert hover:text-alert"
        >
          <Trash2 className="size-4" /> Delete
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete “${humanizeKey(flag.key)}”?`}
        confirmLabel="Delete"
        tone="danger"
        busy={saving}
        onConfirm={doDelete}
        onCancel={() => {
          if (!saving) setConfirmDelete(false);
        }}
      >
        <p>
          This removes it completely and the app goes back to its built-in default. Prefer{" "}
          <strong className="text-ink">Archive</strong> if you might want it back.
        </p>
      </ConfirmDialog>
    </div>
  );
}

// ── Value editor ───────────────────────────────────────────────────────

function ValueEditor({
  valueType,
  value,
  setValue,
  jsonText,
  setJsonText,
  jsonError,
}: {
  valueType: FlagValueType;
  value: unknown;
  setValue: (v: unknown) => void;
  jsonText: string;
  setJsonText: (t: string) => void;
  jsonError: string | null;
}) {
  if (valueType === "number") {
    return (
      <Input
        type="number"
        value={typeof value === "number" ? value : ""}
        onChange={(e) => setValue(e.target.value === "" ? 0 : Number(e.target.value))}
      />
    );
  }
  if (valueType === "string") {
    return (
      <Input
        value={typeof value === "string" ? value : ""}
        onChange={(e) => setValue(e.target.value)}
        placeholder="The text the app shows"
      />
    );
  }
  return (
    <div className="space-y-1">
      <textarea
        value={jsonText}
        onChange={(e) => setJsonText(e.target.value)}
        rows={5}
        spellCheck={false}
        className="w-full rounded-lg border border-rule/70 bg-paper-sunken/50 px-3 py-2 font-mono text-xs text-ink outline-none focus:border-brand/50"
      />
      {jsonError && <p className="text-xs text-alert">{jsonError}</p>}
    </div>
  );
}

// ── Small parts ────────────────────────────────────────────────────────

const SELECT_CLS =
  "flex h-9 w-full rounded-lg border border-input bg-paper-sunken/40 px-3 py-1 text-sm transition-colors focus-visible:border-brand/60 focus-visible:bg-paper-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30";

function Toggle({
  on,
  busy,
  onClick,
  disabled,
}: {
  on: boolean;
  busy: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      aria-pressed={on}
      title={disabled ? "Restore to switch it" : on ? "Turn off" : "Turn on"}
      className={cn(
        "relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors disabled:opacity-50",
        on ? "border-brand/50 bg-brand/80" : "border-rule/70 bg-paper-sunken",
      )}
    >
      <span
        className={cn(
          "inline-block size-4 rounded-full bg-white shadow-sm transition-transform",
          on ? "translate-x-[22px]" : "translate-x-[3px]",
        )}
      />
    </button>
  );
}

function FieldLabel({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-2">{label}</span>
      {children}
      {hint && <span className="block text-xs font-normal text-ink-3">{hint}</span>}
    </label>
  );
}
