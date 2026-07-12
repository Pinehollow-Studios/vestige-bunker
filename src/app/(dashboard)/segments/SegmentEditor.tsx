"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  IS_OPERATORS,
  NUMBER_OPERATORS,
  SEGMENT_FIELDS,
  fieldByKey,
  isGroup,
  newGroup,
  newRule,
  type SegmentField,
  type SegmentGroup,
  type SegmentNode,
  type SegmentRule,
} from "./fields";
import { deleteSegment, previewSegmentCount, saveSegment } from "./actions";

const SELECT =
  "h-9 rounded-lg border border-input bg-paper-sunken/40 px-2.5 text-sm transition-colors focus-visible:border-brand/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30";

export type CountyOption = { id: string; name: string };

export function SegmentEditor({
  id,
  initialName,
  initialDescription,
  initialDefinition,
  counties,
}: {
  id: string;
  initialName: string;
  initialDescription: string | null;
  initialDefinition: SegmentGroup;
  counties: CountyOption[];
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [root, setRoot] = useState<SegmentGroup>(
    initialDefinition && isGroup(initialDefinition) ? initialDefinition : newGroup(),
  );
  const [count, setCount] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);
  const [pending, startTransition] = useTransition();

  const defKey = useMemo(() => JSON.stringify(root), [root]);

  // Live member count — debounced on every definition change.
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      setCounting(true);
      const r = await previewSegmentCount(root);
      if (cancelled) return;
      setCounting(false);
      setCount(r.ok ? (r.data ?? 0) : null);
      if (!r.ok) toast.error(r.message);
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defKey]);

  function save() {
    startTransition(async () => {
      const r = await saveSegment(id, name, description || null, root);
      if (!r.ok) toast.error(r.message);
      else toast.success("Saved");
    });
  }

  function remove() {
    if (!window.confirm("Delete this segment?")) return;
    startTransition(async () => {
      const r = await deleteSegment(id);
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      router.push("/segments");
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-5">
        <section className="space-y-4 rounded-xl glass-panel p-5">
          <div className="space-y-1">
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Active players in Surrey" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional — what this audience is for" />
          </div>
        </section>

        <section className="space-y-3 rounded-xl glass-panel p-5">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">Who&apos;s in it</h3>
          <p className="text-xs text-ink-3">Build the rules. A member has to match the whole thing.</p>
          <GroupEditor group={root} counties={counties} onChange={setRoot} depth={0} />
        </section>

        <Button onClick={save} disabled={pending} className="w-full">
          {pending ? "Saving…" : "Save segment"}
        </Button>
      </div>

      <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <section className="rounded-xl glass-panel p-5 text-center">
          <span className="mx-auto flex size-9 items-center justify-center rounded-full bg-brand/10 text-brand">
            <Users className="size-4" />
          </span>
          <p className="mt-3 font-display text-3xl font-semibold tabular-nums text-ink">
            {counting ? "…" : count === null ? "—" : count.toLocaleString()}
          </p>
          <p className="text-xs uppercase tracking-wider text-ink-3">members match</p>
          <p className="mt-2 text-xs text-ink-3">Updates live as you edit. This is a real count of app members right now.</p>
        </section>

        <Button onClick={remove} disabled={pending} variant="ghost" size="sm" className="w-full text-alert">
          <Trash2 className="size-4" /> Delete segment
        </Button>
      </div>
    </div>
  );
}

// ── Recursive builder ──────────────────────────────────────────────────

function GroupEditor({
  group,
  counties,
  onChange,
  onRemove,
  depth,
}: {
  group: SegmentGroup;
  counties: CountyOption[];
  onChange: (g: SegmentGroup) => void;
  onRemove?: () => void;
  depth: number;
}) {
  function setChild(i: number, node: SegmentNode) {
    onChange({ ...group, rules: group.rules.map((r, idx) => (idx === i ? node : r)) });
  }
  function removeChild(i: number) {
    onChange({ ...group, rules: group.rules.filter((_, idx) => idx !== i) });
  }

  return (
    <div className={cn("rounded-xl border p-3", depth === 0 ? "border-rule/60 bg-paper-sunken/20" : "border-brand/25 bg-brand/[0.03]")}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="inline-flex overflow-hidden rounded-lg border border-border">
          {(["and", "or"] as const).map((op) => (
            <button
              key={op}
              onClick={() => onChange({ ...group, op })}
              className={cn(
                "px-2.5 py-1 text-xs font-medium transition-colors",
                group.op === op ? "bg-brand/15 text-brand" : "bg-surface-2 text-ink-2 hover:text-ink",
              )}
            >
              {op === "and" ? "Match all" : "Match any"}
            </button>
          ))}
        </div>
        {onRemove && (
          <button onClick={onRemove} className="text-ink-3 hover:text-alert" aria-label="Remove group">
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="space-y-2">
        {group.rules.map((node, i) =>
          isGroup(node) ? (
            <GroupEditor key={i} group={node} counties={counties} onChange={(g) => setChild(i, g)} onRemove={() => removeChild(i)} depth={depth + 1} />
          ) : (
            <RuleEditor key={i} rule={node} counties={counties} onChange={(r) => setChild(i, r)} onRemove={() => removeChild(i)} />
          ),
        )}
        {group.rules.length === 0 && <p className="px-1 py-2 text-xs text-ink-3">No rules — this matches everyone.</p>}
      </div>

      <div className="mt-2.5 flex gap-2">
        <button
          onClick={() => onChange({ ...group, rules: [...group.rules, newRule()] })}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-ink-2 transition-colors hover:text-ink"
        >
          <Plus className="size-3" /> Condition
        </button>
        {depth < 2 && (
          <button
            onClick={() => onChange({ ...group, rules: [...group.rules, newGroup()] })}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-ink-2 transition-colors hover:text-ink"
          >
            <Plus className="size-3" /> Group
          </button>
        )}
      </div>
    </div>
  );
}

function RuleEditor({
  rule,
  counties,
  onChange,
  onRemove,
}: {
  rule: SegmentRule;
  counties: CountyOption[];
  onChange: (r: SegmentRule) => void;
  onRemove: () => void;
}) {
  const field = fieldByKey(rule.field) ?? SEGMENT_FIELDS[0];

  function changeField(key: string) {
    const f = fieldByKey(key)!;
    onChange(defaultRuleForField(f));
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-rule/50 bg-surface-1/60 p-2">
      <select className={SELECT} value={rule.field} onChange={(e) => changeField(e.target.value)}>
        {(["Behaviour", "Profile", "Demographics"] as const).map((g) => (
          <optgroup key={g} label={g}>
            {SEGMENT_FIELDS.filter((f) => f.group === g).map((f) => (
              <option key={f.key} value={f.key}>{f.label}</option>
            ))}
          </optgroup>
        ))}
      </select>

      {field.kind === "number" && (
        <>
          <select className={SELECT} value={rule.operator} onChange={(e) => onChange({ ...rule, operator: e.target.value })}>
            {NUMBER_OPERATORS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <input
            type="number"
            className={cn(SELECT, "w-20")}
            value={Number(rule.value)}
            onChange={(e) => onChange({ ...rule, value: Number(e.target.value) })}
          />
          <span className="text-xs text-ink-3">{field.unit}</span>
        </>
      )}

      {field.kind === "enum" && (
        <>
          <select className={SELECT} value={rule.operator} onChange={(e) => onChange({ ...rule, operator: e.target.value })}>
            {IS_OPERATORS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select className={SELECT} value={String(rule.value)} onChange={(e) => onChange({ ...rule, value: e.target.value })}>
            {field.options?.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </>
      )}

      {field.kind === "county" && (
        <>
          <select className={SELECT} value={rule.operator} onChange={(e) => onChange({ ...rule, operator: e.target.value })}>
            {IS_OPERATORS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select className={cn(SELECT, "max-w-[160px]")} value={String(rule.value)} onChange={(e) => onChange({ ...rule, value: e.target.value })}>
            <option value="">Choose a county…</option>
            {counties.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </>
      )}

      {field.kind === "bool" && (
        <select className={SELECT} value={rule.value ? "true" : "false"} onChange={(e) => onChange({ ...rule, operator: "eq", value: e.target.value === "true" })}>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      )}

      {field.kind === "text" && (
        <>
          <select className={SELECT} value={rule.operator} onChange={(e) => onChange({ ...rule, operator: e.target.value })}>
            {IS_OPERATORS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <Input className="h-9 w-32" value={String(rule.value)} onChange={(e) => onChange({ ...rule, value: e.target.value })} />
        </>
      )}

      <button onClick={onRemove} className="ml-auto text-ink-3 hover:text-alert" aria-label="Remove condition">
        <X className="size-4" />
      </button>
    </div>
  );
}

function defaultRuleForField(f: SegmentField): SegmentRule {
  if (f.kind === "number") return { field: f.key, operator: "gte", value: 1 };
  if (f.kind === "bool") return { field: f.key, operator: "eq", value: true };
  if (f.kind === "enum") return { field: f.key, operator: "eq", value: f.options?.[0]?.value ?? "" };
  return { field: f.key, operator: "eq", value: "" };
}
