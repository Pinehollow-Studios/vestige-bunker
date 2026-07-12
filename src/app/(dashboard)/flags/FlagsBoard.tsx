"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, FlaskConical, Plus, Radio, Trash2, Users } from "lucide-react";
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
  audienceSummary,
  defaultValueFor,
  valueSummary,
  VALUE_TYPE_LABELS,
  VALUE_TYPES,
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
  const active = flags.filter((f) => !f.archived);
  const archived = flags.filter((f) => f.archived);
  const [showArchived, setShowArchived] = useState(false);

  return (
    <div className="space-y-5">
      <p className="max-w-3xl text-sm text-ink-2">
        Flip a feature, roll it out gradually, target a cohort, or tune a value — no app release. A
        flag off (or a user outside its rollout / audience) delivers nothing, so the app falls back to
        its built-in default. Changes apply on the next app launch.
      </p>

      <NewFlagPanel existingKeys={new Set(flags.map((f) => f.key))} />

      {active.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-paper-raised/50 p-8 text-center text-sm text-ink-3">
          No active flags yet. Create one above.
        </div>
      ) : (
        <div className="space-y-3">
          {active.map((flag) => (
            <FlagCard
              key={flag.key}
              flag={flag}
              counties={counties}
              allUsers={allUsers}
              initialTargetIds={targetsByFlag[flag.key] ?? []}
            />
          ))}
        </div>
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
          {showArchived &&
            archived.map((flag) => (
              <FlagCard
                key={flag.key}
                flag={flag}
                counties={counties}
                allUsers={allUsers}
                initialTargetIds={targetsByFlag[flag.key] ?? []}
              />
            ))}
        </div>
      )}
    </div>
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
      toast.error("Key must be lower_snake_case, e.g. new_home_hero");
      return;
    }
    if (existingKeys.has(trimmed)) {
      toast.error("A flag with that key already exists");
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
      toast.success("Flag created — off by default. Configure it below.");
      reset();
      router.refresh();
    });
  }

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> New flag
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-xl glass-panel p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <FieldLabel label="Key" hint="Lower snake_case. This is what the app reads.">
          <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="new_home_hero" />
        </FieldLabel>
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
      </div>
      <FieldLabel label="Description" hint="What this controls — for the team.">
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Show the redesigned Home hero"
        />
      </FieldLabel>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={reset} disabled={pending}>
          Cancel
        </Button>
        <Button onClick={create} disabled={pending || !key.trim()}>
          {pending ? "Creating…" : "Create flag"}
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
      toast.success(next ? "Flag turned on" : "Flag turned off");
      router.refresh();
    });
  }

  return (
    <div className={cn("rounded-xl glass-panel p-4", flag.archived && "opacity-70")}>
      <div className="flex items-start gap-3">
        <Toggle on={enabled} busy={toggling} onClick={toggle} disabled={flag.archived} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded bg-paper-sunken/70 px-1.5 py-0.5 font-mono text-[13px] text-ink">
              {flag.key}
            </code>
            <StatusPill enabled={enabled} archived={flag.archived} />
          </div>
          {flag.description && <p className="mt-1 text-sm text-ink-2">{flag.description}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
            <span>
              delivers <span className="font-mono text-ink-2">{valueSummary(flag)}</span>
            </span>
            <span aria-hidden>·</span>
            <span>{audienceSummary(flag)}</span>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setExpanded((e) => !e)}>
          <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} />
          {expanded ? "Close" : "Configure"}
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

  const [saving, startSave] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reach, setReach] = useState<number | null>(null);
  const [reaching, startReach] = useTransition();

  function commitValue(): unknown | undefined {
    if (flag.value_type === "json") {
      try {
        const parsed = JSON.parse(jsonText);
        setJsonError(null);
        return parsed;
      } catch {
        setJsonError("Not valid JSON");
        return undefined;
      }
    }
    return value;
  }

  function save() {
    const committed = commitValue();
    if (committed === undefined && flag.value_type === "json") {
      toast.error("Fix the JSON value first");
      return;
    }
    const input: UpsertFlagInput = {
      key: flag.key,
      description: description.trim(),
      value_type: flag.value_type,
      value: committed,
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
      toast.success("Saved — applies on next app launch");
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
      toast.success(flag.archived ? "Unarchived" : "Archived");
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
      toast.success("Flag deleted");
      onSaved();
    });
  }

  return (
    <div className="mt-4 space-y-4 border-t border-rule/60 pt-4">
      <FieldLabel label="Description">
        <Input value={description} onChange={(e) => setDescription(e.target.value)} />
      </FieldLabel>

      {/* Delivered value. */}
      <div className="space-y-1.5">
        <Label className="text-xs">
          Value delivered to in-scope users{" "}
          <span className="font-normal text-ink-3">({VALUE_TYPE_LABELS[flag.value_type]})</span>
        </Label>
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

      {/* Rollout. */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Rollout</Label>
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
        <p className="text-xs text-ink-3">
          Share of the audience that receives the value. Stable per user — the same people stay in as
          you raise it.
        </p>
      </div>

      {/* Targeting (shared with broadcasts/campaigns). */}
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

      {/* Actions. */}
      <div className="flex flex-wrap items-center gap-2 border-t border-rule/60 pt-3">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
        <Button variant="outline" size="sm" onClick={checkReach} disabled={reaching}>
          <Radio className="size-4" />
          {reaching ? "Checking…" : reach !== null ? `Reaches ${reach}` : "Check reach"}
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={toggleArchive} disabled={saving}>
            {flag.archived ? "Unarchive" : "Archive"}
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
      </div>

      {reach !== null && (
        <p className="flex items-center gap-1.5 text-xs text-ink-3">
          <Users className="size-3.5" />
          {reach} {reach === 1 ? "user" : "users"} currently match this flag (enabled + audience +
          rollout, against each user&apos;s last-seen version).
        </p>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this flag?"
        confirmLabel="Delete"
        tone="danger"
        busy={saving}
        onConfirm={doDelete}
        onCancel={() => {
          if (!saving) setConfirmDelete(false);
        }}
      >
        <p>
          Deleting <code className="font-mono text-ink">{flag.key}</code> removes it entirely. The app
          falls back to its built-in default for this key. Prefer <strong>Archive</strong> to keep the
          history.
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
  if (valueType === "boolean") {
    return (
      <div className="flex gap-1.5">
        {[true, false].map((v) => (
          <button
            key={String(v)}
            type="button"
            onClick={() => setValue(v)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm font-semibold transition",
              value === v
                ? "border-brand/40 bg-brand/10 text-brand ring-1 ring-brand/40"
                : "border-rule/70 bg-paper-sunken/60 text-ink-2 hover:border-brand/30",
            )}
          >
            {v ? "true" : "false"}
          </button>
        ))}
      </div>
    );
  }
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
        placeholder="Delivered text"
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
      title={disabled ? "Unarchive to toggle" : on ? "Turn off" : "Turn on"}
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

function StatusPill({ enabled, archived }: { enabled: boolean; archived: boolean }) {
  if (archived) {
    return (
      <span className="rounded-full border border-ink-3/30 bg-ink-3/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-3">
        Archived
      </span>
    );
  }
  return enabled ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-brand/40 bg-brand px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-fg">
      <FlaskConical className="size-2.5" /> Live
    </span>
  ) : (
    <span className="rounded-full border border-rule/70 bg-paper-sunken/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-3">
      Off
    </span>
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
