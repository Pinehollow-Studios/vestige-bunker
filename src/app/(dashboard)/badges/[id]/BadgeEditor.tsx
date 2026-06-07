"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { BadgeMedallion } from "@/components/badges/BadgeMedallion";
import {
  backfillBadge,
  deleteBadge,
  grantBadgeToUser,
  removeBadgeArt,
  revokeBadgeFromUser,
  setBadgeArchived,
  setBadgePublished,
  updateBadge,
  uploadBadgeArt,
  type BadgePatch,
} from "../actions";
import {
  CATEGORIES, COURSE_TIERS, EFFECTS, GLYPH_OPTIONS, METRIC_LABELS,
  SCOPEABLE_METRICS, SHAPES, statusFor, STATUS_LABELS, THEME_COLORS, THEMES,
  TIER_RING, TIERS,
  type BadgeCategory, type BadgeDefinitionRow, type BadgeEffect, type BadgeShape,
  type BadgeTheme, type BadgeTier, type CountyOption, type CourseOption,
  type Criteria, type CriteriaMetric, type CriteriaType, type CuratedListOption,
} from "../types";

const SELECT_CLS =
  "flex h-9 w-full rounded-lg border border-input bg-paper-sunken/40 px-3 py-1 text-sm transition-colors focus-visible:border-brand/60 focus-visible:bg-paper-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30";
const TEXTAREA_CLS =
  "flex min-h-20 w-full rounded-lg border border-input bg-paper-sunken/40 px-3 py-2 text-sm transition-colors placeholder:text-ink-3 focus-visible:border-brand/60 focus-visible:bg-paper-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30";

export function BadgeEditor({
  row,
  counties,
  lists,
  courses,
}: {
  row: BadgeDefinitionRow;
  counties: CountyOption[];
  lists: CuratedListOption[];
  courses: CourseOption[];
}) {
  // Editorial + visual + criteria state — the live preview reads from here so
  // every control updates the medallion instantly.
  const [name, setName] = useState(row.name);
  const [slug, setSlug] = useState(row.slug);
  const [tagline, setTagline] = useState(row.tagline ?? "");
  const [description, setDescription] = useState(row.description ?? "");
  const [howToEarn, setHowToEarn] = useState(row.how_to_earn ?? "");
  const [glyph, setGlyph] = useState(row.glyph);
  const [theme, setTheme] = useState<BadgeTheme>(row.theme);
  const [tintHex, setTintHex] = useState(row.tint_hex ?? "");
  const [tier, setTier] = useState<BadgeTier>(row.tier);
  const [shape, setShape] = useState<BadgeShape>(row.shape);
  const [effect, setEffect] = useState<BadgeEffect>(row.effect);
  const [category, setCategory] = useState<BadgeCategory>(row.category);
  const [seriesKey, setSeriesKey] = useState(row.series_key ?? "");
  const [seriesRank, setSeriesRank] = useState(row.series_rank?.toString() ?? "");
  const [displayPriority, setDisplayPriority] = useState(row.display_priority.toString());
  const [isSecret, setIsSecret] = useState(row.is_secret);
  const [criteria, setCriteria] = useState<Criteria>(row.criteria);
  const [pending, startTransition] = useTransition();

  const spec = { glyph, theme, tint_hex: tintHex || null, tier, shape, effect };

  const patch: BadgePatch = {
    name, slug,
    tagline, description, how_to_earn: howToEarn,
    glyph, theme, tint_hex: tintHex || null, tier, shape, effect,
    category, series_key: seriesKey || null,
    series_rank: seriesRank.trim() === "" ? null : Number(seriesRank),
    display_priority: displayPriority.trim() === "" ? 0 : Number(displayPriority),
    is_secret: isSecret,
    criteria,
  };

  // Cheap, render-time diff against the loaded row — no memo (the patch object
  // is rebuilt every render anyway, which would defeat one).
  const dirty =
    JSON.stringify(patch) !==
    JSON.stringify({
      name: row.name, slug: row.slug,
      tagline: row.tagline ?? "", description: row.description ?? "",
      how_to_earn: row.how_to_earn ?? "",
      glyph: row.glyph, theme: row.theme, tint_hex: row.tint_hex,
      tier: row.tier, shape: row.shape, effect: row.effect,
      category: row.category, series_key: row.series_key,
      series_rank: row.series_rank, display_priority: row.display_priority,
      is_secret: row.is_secret, criteria: row.criteria,
    });

  function save() {
    startTransition(async () => {
      const result = await updateBadge(row.id, patch);
      if (!result.ok) toast.error(result.message);
      else toast.success("Saved");
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      {/* Sticky preview + lifecycle */}
      <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <PreviewCard spec={spec} name={name} tier={tier} />
        <Lifecycle row={row} pending={pending} dirty={dirty} onSave={save} />
        <ArtCard row={row} />
        <ManualGrant row={row} />
      </div>

      {/* Form */}
      <div className="space-y-6">
        <Card title="Artwork" hint="How the badge looks in the app. Composed natively — crisp at any size.">
          <GlyphPicker glyph={glyph} setGlyph={setGlyph} />
          <Swatches label="Theme" >
            {THEMES.map((t) => (
              <SwatchButton
                key={t}
                selected={theme === t}
                onClick={() => setTheme(t)}
                title={t}
                style={{ background: `linear-gradient(135deg, ${THEME_COLORS[t][0]}, ${THEME_COLORS[t][1]})` }}
              />
            ))}
          </Swatches>
          <Swatches label="Tier (rarity frame)">
            {TIERS.map((t) => (
              <SwatchButton
                key={t}
                selected={tier === t}
                onClick={() => setTier(t)}
                title={t}
                style={{ background: `linear-gradient(135deg, ${TIER_RING[t].join(", ")})` }}
                label={t}
              />
            ))}
          </Swatches>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Shape">
              <select className={SELECT_CLS} value={shape} onChange={(e) => setShape(e.target.value as BadgeShape)}>
                {SHAPES.map((s) => <option key={s} value={s}>{cap(s)}</option>)}
              </select>
            </Field>
            <Field label="Effect">
              <select className={SELECT_CLS} value={effect} onChange={(e) => setEffect(e.target.value as BadgeEffect)}>
                {EFFECTS.map((s) => <option key={s} value={s}>{cap(s)}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Colour override (optional)" hint="6-digit hex, e.g. 5BE4C3. Overrides the theme face colour.">
            <Input value={tintHex} onChange={(e) => setTintHex(e.target.value)} placeholder="leave blank for theme" />
          </Field>
        </Card>

        <Card title="Editorial" hint="The words users read — keep them warm and specific.">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Slug" hint="URL-safe id."><Input value={slug} onChange={(e) => setSlug(e.target.value)} /></Field>
          </div>
          <Field label="Tagline" hint="One line on the tile + detail.">
            <Input value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={80} placeholder="One hundred courses" />
          </Field>
          <Field label="Description" hint="Longer flavour on the detail sheet.">
            <textarea className={TEXTAREA_CLS} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label="How to earn" hint="Plain instructions shown on locked badges.">
            <textarea className={TEXTAREA_CLS} rows={2} value={howToEarn} onChange={(e) => setHowToEarn(e.target.value)} placeholder="Play 100 different courses." />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category" hint="Groups the badge in the app.">
              <select className={SELECT_CLS} value={category} onChange={(e) => setCategory(e.target.value as BadgeCategory)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{cap(c)}</option>)}
              </select>
            </Field>
            <Field label="Display priority" hint="Higher floats up.">
              <Input type="number" value={displayPriority} onChange={(e) => setDisplayPriority(e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Series key" hint="Groups a bronze→gold ladder. Optional.">
              <Input value={seriesKey} onChange={(e) => setSeriesKey(e.target.value)} placeholder="courses-played" />
            </Field>
            <Field label="Series rank" hint="Order within the series.">
              <Input type="number" value={seriesRank} onChange={(e) => setSeriesRank(e.target.value)} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-2">
            <input type="checkbox" checked={isSecret} onChange={(e) => setIsSecret(e.target.checked)} />
            Secret — hidden in the app until earned
          </label>
        </Card>

        <Card title="How it's earned" hint="The rule the server checks. No code — pick a metric and a target.">
          <CriteriaBuilder
            criteria={criteria}
            setCriteria={setCriteria}
            counties={counties}
            lists={lists}
            courses={courses}
          />
        </Card>

        <Button onClick={save} disabled={!dirty || pending} className="w-full">
          {pending ? "Saving…" : dirty ? "Save changes" : "No changes"}
        </Button>
      </div>
    </div>
  );
}

// ── Preview ─────────────────────────────────────────────────────────

function PreviewCard({
  spec, name, tier,
}: {
  spec: Parameters<typeof BadgeMedallion>[0]["spec"];
  name: string;
  tier: BadgeTier;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-rule/70 bg-paper-raised/50 p-5">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
        Live preview
      </h3>
      <div className="flex flex-col items-center gap-3 rounded-xl bg-[#0E1822] p-6">
        <BadgeMedallion spec={spec} size={132} />
        <p className="text-center font-heading text-sm font-semibold text-[#F3F0E5]">{name}</p>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#9BB0C2]">{tier}</span>
      </div>
      <div className="flex items-center justify-around rounded-xl bg-[#0E1822] p-4">
        <div className="flex flex-col items-center gap-1.5">
          <BadgeMedallion spec={spec} size={64} earned={false} progress={0.62} />
          <span className="text-[10px] text-[#9BB0C2]">Locked</span>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <BadgeMedallion spec={spec} size={48} />
          <span className="text-[10px] text-[#9BB0C2]">Grid</span>
        </div>
      </div>
    </section>
  );
}

// ── Glyph picker ────────────────────────────────────────────────────

function GlyphPicker({ glyph, setGlyph }: { glyph: string; setGlyph: (g: string) => void }) {
  const known = GLYPH_OPTIONS.some((g) => g.sf === glyph);
  return (
    <Field label="Glyph" hint="The symbol inside the badge. Pick one, or type any SF Symbol name.">
      <div className="grid grid-cols-8 gap-1.5">
        {GLYPH_OPTIONS.map((g) => (
          <button
            key={g.sf}
            type="button"
            title={g.label}
            onClick={() => setGlyph(g.sf)}
            className={cn(
              "flex aspect-square items-center justify-center rounded-lg border bg-paper-sunken/40 transition-colors hover:border-brand/50",
              glyph === g.sf ? "border-brand bg-brand/10 ring-1 ring-brand/40" : "border-rule/70",
            )}
          >
            <GlyphMini sf={g.sf} />
          </button>
        ))}
      </div>
      <Input
        value={known ? "" : glyph}
        onChange={(e) => setGlyph(e.target.value)}
        placeholder={known ? "or type a custom SF Symbol…" : glyph}
        className="mt-2"
      />
    </Field>
  );
}

function GlyphMini({ sf }: { sf: string }) {
  // Render via the medallion's lucide map by drawing a tiny neutral medallion.
  return (
    <BadgeMedallion
      spec={{ glyph: sf, theme: "slate", tier: "silver", shape: "coin", effect: "none" }}
      size={26}
    />
  );
}

// ── Criteria builder ────────────────────────────────────────────────

function CriteriaBuilder({
  criteria, setCriteria, counties, lists, courses,
}: {
  criteria: Criteria;
  setCriteria: (c: Criteria) => void;
  counties: CountyOption[];
  lists: CuratedListOption[];
  courses: CourseOption[];
}) {
  function changeType(type: CriteriaType) {
    switch (type) {
      case "count_threshold": setCriteria({ type, metric: "courses_played", threshold: 10 }); break;
      case "specific_course": setCriteria({ type, course_id: "" }); break;
      case "specific_county_complete": setCriteria({ type, county_id: "" }); break;
      case "specific_list_complete": setCriteria({ type, curated_list_id: "" }); break;
      case "manual": setCriteria({ type }); break;
    }
  }

  return (
    <div className="space-y-3">
      <Field label="Earned by">
        <select className={SELECT_CLS} value={criteria.type} onChange={(e) => changeType(e.target.value as CriteriaType)}>
          <option value="count_threshold">Reaching a number (courses, rounds, friends…)</option>
          <option value="specific_county_complete">Completing a specific county</option>
          <option value="specific_list_complete">Completing a specific curated list</option>
          <option value="specific_course">Playing a specific course</option>
          <option value="manual">Manual — awarded by an admin</option>
        </select>
      </Field>

      {criteria.type === "count_threshold" && (
        <CountThresholdFields criteria={criteria} setCriteria={setCriteria} counties={counties} />
      )}
      {criteria.type === "specific_county_complete" && (
        <Field label="County">
          <select
            className={SELECT_CLS}
            value={criteria.county_id}
            onChange={(e) => setCriteria({ type: "specific_county_complete", county_id: e.target.value })}
          >
            <option value="">Select a county…</option>
            {counties.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
      )}
      {criteria.type === "specific_list_complete" && (
        <Field label="Curated list">
          <select
            className={SELECT_CLS}
            value={criteria.curated_list_id}
            onChange={(e) => setCriteria({ type: "specific_list_complete", curated_list_id: e.target.value })}
          >
            <option value="">Select a list…</option>
            {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </Field>
      )}
      {criteria.type === "specific_course" && (
        <Field label="Course">
          <select
            className={SELECT_CLS}
            value={criteria.course_id}
            onChange={(e) => setCriteria({ type: "specific_course", course_id: e.target.value })}
          >
            <option value="">Select a course…</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.county_name ? ` — ${c.county_name}` : ""}</option>
            ))}
          </select>
        </Field>
      )}
      {criteria.type === "manual" && (
        <p className="rounded-lg border border-rule/70 bg-paper-sunken/40 p-3 text-xs text-ink-2">
          This badge won&apos;t auto-mint. Grant it to users from the panel on the left
          (Founding Member, event badges, one-offs).
        </p>
      )}
    </div>
  );
}

function CountThresholdFields({
  criteria, setCriteria, counties,
}: {
  criteria: Extract<Criteria, { type: "count_threshold" }>;
  setCriteria: (c: Criteria) => void;
  counties: CountyOption[];
}) {
  const scopeable = SCOPEABLE_METRICS.includes(criteria.metric);
  const scope = criteria.scope ?? {};
  function setScope(next: typeof scope) {
    const cleaned = Object.fromEntries(Object.entries(next).filter(([, v]) => v));
    setCriteria({ ...criteria, scope: Object.keys(cleaned).length ? cleaned : undefined });
  }
  return (
    <div className="space-y-3 rounded-lg border border-rule/70 bg-paper-sunken/30 p-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Count of">
          <select
            className={SELECT_CLS}
            value={criteria.metric}
            onChange={(e) => setCriteria({ type: "count_threshold", metric: e.target.value as CriteriaMetric, threshold: criteria.threshold })}
          >
            {(Object.keys(METRIC_LABELS) as CriteriaMetric[]).map((m) => (
              <option key={m} value={m}>{METRIC_LABELS[m]}</option>
            ))}
          </select>
        </Field>
        <Field label="Target (≥)">
          <Input
            type="number"
            min={1}
            value={criteria.threshold}
            onChange={(e) => setCriteria({ ...criteria, threshold: Math.max(1, Number(e.target.value) || 1) })}
          />
        </Field>
      </div>
      {scopeable && (
        <div className="space-y-2 border-t border-rule/70 pt-2">
          <p className="text-[11px] uppercase tracking-wider text-ink-3">Limit to (optional)</p>
          <div className="grid grid-cols-3 gap-2">
            <select
              className={SELECT_CLS}
              value={scope.county_id ?? ""}
              onChange={(e) => setScope({ ...scope, county_id: e.target.value || undefined })}
            >
              <option value="">Any county</option>
              {counties.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select
              className={SELECT_CLS}
              value={scope.tier ?? ""}
              onChange={(e) => setScope({ ...scope, tier: e.target.value || undefined })}
            >
              <option value="">Any tier</option>
              {COURSE_TIERS.map((t) => <option key={t} value={t}>{cap(t)}</option>)}
            </select>
            <Input
              value={scope.style ?? ""}
              onChange={(e) => setScope({ ...scope, style: e.target.value || undefined })}
              placeholder="Any style"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Lifecycle ───────────────────────────────────────────────────────

function Lifecycle({
  row, pending, dirty, onSave,
}: {
  row: BadgeDefinitionRow;
  pending: boolean;
  dirty: boolean;
  onSave: () => void;
}) {
  const [busy, start] = useTransition();
  const status = statusFor(row);
  const working = busy || pending;

  function publish(published: boolean) {
    start(async () => {
      const r = await setBadgePublished(row.id, published);
      if (!r.ok) toast.error(r.message);
      else toast.success(published ? "Published — live in the app" : "Unpublished");
    });
  }
  function archive(archived: boolean) {
    start(async () => {
      const r = await setBadgeArchived(row.id, archived);
      if (!r.ok) toast.error(r.message);
      else toast.success(archived ? "Archived" : "Restored");
    });
  }
  function backfill() {
    start(async () => {
      const r = await backfillBadge(row.id);
      if (!r.ok) toast.error(r.message);
      else toast.success(`Awarded to ${r.data ?? 0} qualifying ${r.data === 1 ? "user" : "users"}`);
    });
  }
  function destroy() {
    if (!confirm(`Delete "${row.name}" permanently? Earned copies are removed too. This can't be undone.`)) return;
    start(async () => {
      const r = await deleteBadge(row.id);
      if (!r.ok) toast.error(r.message);
    });
  }

  return (
    <section className="space-y-3 rounded-xl border border-rule/70 bg-paper-raised/50 p-5">
      <header className="space-y-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">Lifecycle</h3>
        <p className="text-xs text-ink-3">Currently <span className="font-medium text-ink-2">{STATUS_LABELS[status]}</span>.</p>
      </header>

      {dirty && (
        <p className="rounded-md border border-amber/30 bg-amber/10 px-2 py-1 text-[11px] text-ink-2">
          Unsaved changes — save before publishing.
        </p>
      )}

      {status !== "live" ? (
        <Button onClick={() => publish(true)} disabled={working || dirty} className="w-full bg-brand text-brand-fg hover:bg-brand-deep">
          Publish
        </Button>
      ) : (
        <Button onClick={() => publish(false)} disabled={working} variant="outline" className="w-full">
          Unpublish
        </Button>
      )}

      {row.criteria.type !== "manual" && (
        <Button onClick={backfill} disabled={working || status !== "live"} variant="outline" className="w-full">
          Award to everyone who qualifies
        </Button>
      )}
      <p className="text-[11px] text-muted-foreground/80">
        New badges only land on a user&apos;s next relevant action. Backfill grants it now to anyone already over the line.
      </p>

      <div className="space-y-2 border-t pt-3">
        <Label className="text-xs text-destructive">Danger zone</Label>
        {status === "archived" ? (
          <Button onClick={() => archive(false)} variant="outline" disabled={working} className="w-full">Restore</Button>
        ) : (
          <Button onClick={() => archive(true)} variant="outline" disabled={working} className="w-full">Archive</Button>
        )}
        <Button onClick={destroy} variant="destructive" disabled={working} className="w-full">Delete permanently</Button>
      </div>

      {/* keep onSave referenced for the keyboard-less flow */}
      <button type="button" onClick={onSave} className="sr-only">save</button>
    </section>
  );
}

// ── Custom art ──────────────────────────────────────────────────────

function ArtCard({ row }: { row: BadgeDefinitionRow }) {
  const [busy, start] = useTransition();
  const fileRef = useRef<HTMLInputElement | null>(null);

  function onPick(file: File) {
    start(async () => {
      const fd = new FormData();
      fd.append("art", file);
      const r = await uploadBadgeArt(row.id, fd);
      if (!r.ok) toast.error(r.message);
      else toast.success("Artwork uploaded");
    });
  }
  function remove() {
    start(async () => {
      const r = await removeBadgeArt(row.id);
      if (!r.ok) toast.error(r.message);
      else toast.success("Artwork removed");
    });
  }

  return (
    <section className="space-y-2 rounded-xl border border-rule/70 bg-paper-raised/50 p-5">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">Custom artwork</h3>
      <p className="text-xs text-ink-3">
        Optional. Overrides the composed medallion with an uploaded PNG (transparent, square). Most badges don&apos;t need this.
      </p>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/webp"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onPick(file);
        }}
      />
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
          {row.custom_image_key ? "Replace" : "Upload PNG"}
        </Button>
        {row.custom_image_key && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={remove}>Remove</Button>
        )}
      </div>
    </section>
  );
}

// ── Manual grant ────────────────────────────────────────────────────

function ManualGrant({ row }: { row: BadgeDefinitionRow }) {
  const [userId, setUserId] = useState("");
  const [busy, start] = useTransition();

  function grant() {
    start(async () => {
      const r = await grantBadgeToUser(row.id, userId);
      if (!r.ok) toast.error(r.message);
      else { toast.success("Granted"); setUserId(""); }
    });
  }
  function revoke() {
    start(async () => {
      const r = await revokeBadgeFromUser(row.id, userId);
      if (!r.ok) toast.error(r.message);
      else { toast.success("Revoked"); setUserId(""); }
    });
  }

  return (
    <section className="space-y-2 rounded-xl border border-rule/70 bg-paper-raised/50 p-5">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">Grant to a user</h3>
      <p className="text-xs text-ink-3">Paste a user UUID to award or remove this badge directly.</p>
      <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="user UUID" className="font-mono text-xs" />
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={busy || !userId.trim()} onClick={grant} className="bg-brand text-brand-fg hover:bg-brand-deep">Grant</Button>
        <Button size="sm" variant="ghost" disabled={busy || !userId.trim()} onClick={revoke}>Revoke</Button>
      </div>
    </section>
  );
}

// ── Small layout helpers ────────────────────────────────────────────

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-xl border border-rule/70 bg-paper-raised/50 p-5">
      <header className="space-y-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">{title}</h3>
        {hint && <p className="text-xs text-ink-3">{hint}</p>}
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

function Swatches({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function SwatchButton({
  selected, onClick, title, style, label,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  style: React.CSSProperties;
  label?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "flex h-8 items-center gap-1 rounded-lg border px-1 transition-transform hover:scale-105",
        selected ? "border-brand ring-2 ring-brand/40" : "border-rule/70",
      )}
    >
      <span className="size-6 rounded-md" style={style} />
      {label && <span className="pr-1 text-[10px] font-semibold uppercase tracking-wide text-ink-2">{label}</span>}
    </button>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
