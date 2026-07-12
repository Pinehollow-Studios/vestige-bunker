"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Award,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Flag,
  House,
  ListChecks,
  LogIn,
  type LucideIcon,
  Newspaper,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Trophy,
  Users,
} from "lucide-react";
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
  AREA_ORDER,
  areaFor,
  defaultValueFor,
  humanizeKey,
  isChanged,
  isFeature,
  isOn,
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

const AREA_ICON: Record<string, LucideIcon> = {
  Home: House,
  "Activity feed": Newspaper,
  Friends: Users,
  Leaderboards: Trophy,
  Lists: ListChecks,
  "Log a round": Flag,
  Badges: Award,
  Notifications: Bell,
  Societies: Users,
  Onboarding: LogIn,
  "Sign-in": LogIn,
  Search: Search,
  Other: SlidersHorizontal,
};

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
  const [query, setQuery] = useState("");
  const [openArea, setOpenArea] = useState<string | null>(null);

  const live = useMemo(() => flags.filter((f) => !f.archived), [flags]);
  const searching = query.trim().length > 0;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (f: FlagRow) =>
      !q ||
      humanizeKey(f.key).toLowerCase().includes(q) ||
      f.key.toLowerCase().includes(q) ||
      (f.description ?? "").toLowerCase().includes(q);
  }, [query]);

  // Group live flags by app area, ordered.
  const areas = useMemo(() => {
    const byArea = new Map<string, FlagRow[]>();
    for (const f of live) {
      const a = areaFor(f.key);
      const list = byArea.get(a) ?? [];
      list.push(f);
      byArea.set(a, list);
    }
    return [...byArea.entries()]
      .sort((a, b) => AREA_ORDER.indexOf(a[0]) - AREA_ORDER.indexOf(b[0]))
      .map(([area, items]) => ({
        area,
        items: items.sort((x, y) => Number(isChanged(y)) - Number(isChanged(x))),
      }));
  }, [live]);

  const tileProps = { counties, allUsers, targetsByFlag };

  return (
    <div className="space-y-5">
      {/* Search + add — always available. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-lg border border-rule/70 bg-paper-sunken/40 px-3 py-2">
          <Search aria-hidden className="size-4 text-ink-3" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search everything…"
            className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-3 focus:outline-none"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} className="text-ink-3 hover:text-ink-2" aria-label="Clear">
              ×
            </button>
          )}
        </div>
        <NewFlagPanel existingKeys={new Set(flags.map((f) => f.key))} />
      </div>

      {searching ? (
        // Flat results across every area.
        <SearchResults flags={live.filter(matches)} query={query} {...tileProps} />
      ) : openArea ? (
        // One area, opened.
        <AreaView
          area={openArea}
          items={areas.find((a) => a.area === openArea)?.items ?? []}
          onBack={() => setOpenArea(null)}
          {...tileProps}
        />
      ) : (
        // Landing — overview + a grid of section boxes.
        <>
          <Overview live={live} onOpenArea={setOpenArea} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {areas.map(({ area, items }) => (
              <AreaCard key={area} area={area} items={items} onOpen={() => setOpenArea(area)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Overview (the rethought "on now") ──────────────────────────────────

function Overview({ live, onOpenArea }: { live: FlagRow[]; onOpenArea: (area: string) => void }) {
  const featuresOff = live.filter((f) => isFeature(f.value_type) && !isOn(f));
  const copyEdited = live.filter((f) => f.value_type === "string" && f.enabled);
  const settingsChanged = live.filter((f) => !isFeature(f.value_type) && f.value_type !== "string" && f.enabled);
  const changed = [...featuresOff, ...copyEdited, ...settingsChanged];

  return (
    <div className="rounded-2xl glass-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex size-10 items-center justify-center rounded-xl",
              changed.length === 0 ? "bg-brand/12 text-brand" : "bg-amber/12 text-amber",
            )}
          >
            <CircleCheck className="size-5" />
          </div>
          <div>
            <p className="font-display text-lg font-semibold tracking-tight text-ink">
              {changed.length === 0 ? "Running on defaults" : `${changed.length} changed from default`}
            </p>
            <p className="text-sm text-ink-3">
              {changed.length === 0
                ? "Every feature is on and nothing's overridden."
                : "These differ from what the app ships with."}
            </p>
          </div>
        </div>
        <div className="flex gap-4">
          <Stat label="Controls" value={live.length} />
          <Stat label="Features off" value={featuresOff.length} tone={featuresOff.length ? "warn" : undefined} />
          <Stat label="Edits live" value={copyEdited.length + settingsChanged.length} tone={copyEdited.length + settingsChanged.length ? "warn" : undefined} />
        </div>
      </div>

      {changed.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5 border-t border-rule/50 pt-4">
          {changed.slice(0, 10).map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => onOpenArea(areaFor(f.key))}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                isFeature(f.value_type)
                  ? "border-alert/30 bg-alert/10 text-alert hover:bg-alert/15"
                  : "border-amber/30 bg-amber/10 text-amber hover:bg-amber/15",
              )}
            >
              {humanizeKey(f.key)}
              <span className="opacity-70">{isFeature(f.value_type) ? "off" : "edited"}</span>
            </button>
          ))}
          {changed.length > 10 && <span className="self-center text-xs text-ink-3">+{changed.length - 10} more</span>}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "warn" }) {
  return (
    <div className="text-right">
      <p className={cn("font-mono text-xl font-semibold tabular-nums", tone === "warn" ? "text-amber" : "text-ink")}>
        {value}
      </p>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">{label}</p>
    </div>
  );
}

// ── Landing: a section box per area ────────────────────────────────────

function AreaCard({ area, items, onOpen }: { area: string; items: FlagRow[]; onOpen: () => void }) {
  const Icon = AREA_ICON[area] ?? SlidersHorizontal;
  const off = items.filter((f) => isFeature(f.value_type) && !isOn(f)).length;
  const edited = items.filter((f) => !isFeature(f.value_type) && f.enabled).length;
  const features = items.filter((f) => isFeature(f.value_type)).length;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col gap-3 rounded-2xl border border-border bg-paper-raised/50 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:bg-paper-raised hover:shadow-lg"
    >
      <div className="flex items-center justify-between">
        <div className="flex size-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <Icon className="size-5" />
        </div>
        <ChevronRight className="size-4 text-ink-3 transition-transform group-hover:translate-x-0.5" />
      </div>
      <div>
        <p className="font-medium text-ink">{area}</p>
        <p className="text-xs text-ink-3">
          {items.length} {items.length === 1 ? "control" : "controls"}
          {features > 0 ? ` · ${features} feature${features === 1 ? "" : "s"}` : ""}
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {off > 0 && (
          <span className="rounded-full border border-alert/30 bg-alert/10 px-2 py-0.5 text-[10px] font-semibold text-alert">
            {off} off
          </span>
        )}
        {edited > 0 && (
          <span className="rounded-full border border-amber/30 bg-amber/10 px-2 py-0.5 text-[10px] font-semibold text-amber">
            {edited} edited
          </span>
        )}
        {off === 0 && edited === 0 && (
          <span className="rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">
            all default
          </span>
        )}
      </div>
    </button>
  );
}

// ── Area view (opened section): flags as tiles in a grid ───────────────

function AreaView({
  area,
  items,
  onBack,
  counties,
  allUsers,
  targetsByFlag,
}: {
  area: string;
  items: FlagRow[];
  onBack: () => void;
  counties: CountyOption[];
  allUsers: PickerUser[];
  targetsByFlag: Record<string, string[]>;
}) {
  const Icon = AREA_ICON[area] ?? SlidersHorizontal;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ChevronLeft className="size-4" /> All sections
        </Button>
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-brand/10 text-brand">
            <Icon className="size-4" />
          </div>
          <h2 className="font-display text-lg font-semibold tracking-tight text-ink">{area}</h2>
          <span className="rounded-full bg-paper-sunken/70 px-1.5 py-px text-[10px] tabular-nums text-ink-3">{items.length}</span>
        </div>
      </div>
      <FlagGrid flags={items} counties={counties} allUsers={allUsers} targetsByFlag={targetsByFlag} />
    </div>
  );
}

function SearchResults({
  flags,
  query,
  counties,
  allUsers,
  targetsByFlag,
}: {
  flags: FlagRow[];
  query: string;
  counties: CountyOption[];
  allUsers: PickerUser[];
  targetsByFlag: Record<string, string[]>;
}) {
  if (flags.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-paper-raised/50 p-8 text-center text-sm text-ink-3">
        No matches for “{query}”.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-3">
        {flags.length} {flags.length === 1 ? "match" : "matches"}
      </p>
      <FlagGrid flags={flags} counties={counties} allUsers={allUsers} targetsByFlag={targetsByFlag} />
    </div>
  );
}

/** The tile grid + the one-open-at-a-time editor (opened tile spans full width). */
function FlagGrid({
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
  const [editingKey, setEditingKey] = useState<string | null>(null);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {flags.map((flag) => (
        <FlagTile
          key={flag.key}
          flag={flag}
          editing={editingKey === flag.key}
          onEdit={() => setEditingKey((k) => (k === flag.key ? null : flag.key))}
          counties={counties}
          allUsers={allUsers}
          initialTargetIds={targetsByFlag[flag.key] ?? []}
        />
      ))}
    </div>
  );
}

// ── Flag tile (a box, not a row) ───────────────────────────────────────

function FlagTile({
  flag,
  editing,
  onEdit,
  counties,
  allUsers,
  initialTargetIds,
}: {
  flag: FlagRow;
  editing: boolean;
  onEdit: () => void;
  counties: CountyOption[];
  allUsers: PickerUser[];
  initialTargetIds: string[];
}) {
  const router = useRouter();
  const [on, setOn] = useState(isOn(flag));
  const [toggling, startToggle] = useTransition();
  const [confirmToggle, setConfirmToggle] = useState(false);
  const feature = isFeature(flag.value_type);

  function applyToggle(next: boolean) {
    setOn(next);
    startToggle(async () => {
      const r = feature
        ? await upsertFlag({
            key: flag.key,
            description: flag.description,
            value_type: flag.value_type,
            value: next,
            enabled: true,
            rollout_percentage: flag.rollout_percentage,
            audience_kind: flag.audience_kind,
            target: flag.target ?? {},
            min_app_version: flag.min_app_version,
            max_app_version: flag.max_app_version,
          })
        : await setFlagEnabled(flag.key, next);
      setConfirmToggle(false);
      if (!r.ok) {
        setOn(!next);
        toast.error(r.message);
        return;
      }
      toast.success(next ? "Turned on" : "Turned off");
      router.refresh();
    });
  }

  function requestToggle() {
    if (feature) setConfirmToggle(true);
    else applyToggle(!on);
  }

  const stateLine = feature ? (on ? "On" : "Off") : flag.enabled ? `Custom: ${valueSummary(flag)}` : "Default";

  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border p-4 transition-colors",
        editing && "sm:col-span-2",
        flag.archived
          ? "border-border bg-paper-raised/40 opacity-70"
          : on || (!feature && flag.enabled)
            ? "border-brand/30 bg-brand/[0.05]"
            : "border-border bg-paper-raised/60",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "rounded-full px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide",
            feature ? "bg-info/10 text-info" : "bg-amber/10 text-amber",
          )}
        >
          {kindLabel(flag.value_type)}
        </span>
        <Toggle on={on} busy={toggling} onClick={requestToggle} disabled={flag.archived} />
      </div>

      <p className="mt-2 font-medium text-ink">{humanizeKey(flag.key)}</p>
      {flag.description && <p className="mt-0.5 line-clamp-2 text-xs text-ink-2">{flag.description}</p>}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-rule/50 pt-2.5">
        <span className={cn("text-xs font-medium", feature ? (on ? "text-brand" : "text-ink-3") : flag.enabled ? "text-amber" : "text-ink-3")}>
          {stateLine}
        </span>
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <ChevronDown className={cn("size-4 transition-transform", editing && "rotate-180")} />
          {editing ? "Close" : "Edit"}
        </Button>
      </div>

      {editing && (
        <FlagEditor
          flag={flag}
          counties={counties}
          allUsers={allUsers}
          initialTargetIds={initialTargetIds}
          onSaved={() => router.refresh()}
        />
      )}

      <ConfirmDialog
        open={confirmToggle}
        title={on ? `Turn off “${humanizeKey(flag.key)}”?` : `Turn on “${humanizeKey(flag.key)}”?`}
        confirmLabel={on ? "Turn off" : "Turn on"}
        tone={on ? "danger" : "brand"}
        busy={toggling}
        onConfirm={() => applyToggle(!on)}
        onCancel={() => {
          if (!toggling) setConfirmToggle(false);
        }}
      >
        <p>
          {on
            ? "This hides the feature from everyone in the app (from their next launch)."
            : "This shows the feature to everyone — unless you limit who under Advanced."}
        </p>
      </ConfirmDialog>
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
        <Plus className="size-4" /> Add
      </Button>
    );
  }

  return (
    <div className="w-full space-y-3 rounded-xl glass-panel p-4">
      <FieldLabel label="Type">
        <select className={SELECT_CLS} value={valueType} onChange={(e) => setValueType(e.target.value as FlagValueType)}>
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
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="The redesigned Home hero" />
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
  const [jsonText, setJsonText] = useState(flag.value_type === "json" ? JSON.stringify(flag.value ?? {}, null, 2) : "");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [rollout, setRollout] = useState(flag.rollout_percentage);
  const [audienceKind, setAudienceKind] = useState<BroadcastAudienceKind>(flag.audience_kind);
  const [target, setTarget] = useState<BroadcastTarget>(flag.target ?? {});
  const [minVersion, setMinVersion] = useState(flag.min_app_version ?? "");
  const [maxVersion, setMaxVersion] = useState(flag.max_app_version ?? "");
  const [showAdvanced, setShowAdvanced] = useState(flag.rollout_percentage < 100 || flag.audience_kind !== "everyone");

  const [saving, startSave] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reach, setReach] = useState<number | null>(null);
  const [reaching, startReach] = useTransition();

  function committedValue(): { ok: true; value: unknown } | { ok: false } {
    if (feature) return { ok: true, value: flag.value };
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
      enabled: feature ? true : flag.enabled,
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
    <div className="mt-3 space-y-4 border-t border-rule/60 pt-4">
      <FieldLabel label="What it controls">
        <Input value={description} onChange={(e) => setDescription(e.target.value)} />
      </FieldLabel>

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

      <div className="rounded-lg border border-rule/60 bg-paper-sunken/20">
        <button
          type="button"
          onClick={() => setShowAdvanced((s) => !s)}
          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-ink-2 hover:text-ink"
        >
          <SlidersHorizontal className="size-3.5 text-ink-3" />
          <span className="font-medium">Roll out gradually or limit who sees it</span>
          <span className="ml-auto text-xs text-ink-3">
            {whoSummary({ audience_kind: audienceKind, target_user_count: initialTargetIds.length, rollout_percentage: rollout })}
          </span>
          <ChevronDown className={cn("size-4 text-ink-3 transition-transform", showAdvanced && "rotate-180")} />
        </button>

        {showAdvanced && (
          <div className="space-y-4 border-t border-rule/50 p-3">
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
              <p className="text-xs text-ink-3">The same people stay in as you raise it — nobody flickers in and out.</p>
            </div>

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
      <textarea
        value={typeof value === "string" ? value : ""}
        onChange={(e) => setValue(e.target.value)}
        rows={2}
        placeholder="The text the app shows"
        className="w-full rounded-lg border border-rule/70 bg-paper-sunken/50 px-3 py-2 text-sm text-ink outline-none focus:border-brand/50"
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

function Toggle({ on, busy, onClick, disabled }: { on: boolean; busy: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      aria-pressed={on}
      title={disabled ? "Restore to switch it" : on ? "Turn off" : "Turn on"}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors disabled:opacity-50",
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

function FieldLabel({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-2">{label}</span>
      {children}
      {hint && <span className="block text-xs font-normal text-ink-3">{hint}</span>}
    </label>
  );
}
