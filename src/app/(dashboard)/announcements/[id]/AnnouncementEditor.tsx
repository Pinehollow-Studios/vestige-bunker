"use client";

import { useRef, useState, useTransition } from "react";
import { Check, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  deleteAnnouncement,
  loadRecipients,
  removeHero,
  searchUsers,
  setArchived,
  setPublishState,
  setTargets,
  updateAnnouncement,
  uploadHero,
  type AnnouncementPatch,
} from "../actions";
import {
  ACTION_KINDS,
  ACTION_KIND_LABELS,
  ANNOUNCEMENT_KINDS,
  AUDIENCE_KINDS,
  AUDIENCE_LABELS,
  DEEP_LINK_TOKENS,
  KIND_LABELS,
  PRIVACY_OPTIONS,
  RECIPIENT_STATE_LABELS,
  STATUS_LABELS,
  STYLE_LABELS,
  STYLES,
  statusFor,
  type AnnouncementActionKind,
  type AnnouncementAudienceKind,
  type AnnouncementKind,
  type AnnouncementRecipient,
  type AnnouncementRow,
  type AnnouncementStats,
  type AnnouncementStyle,
  type AnnouncementTarget,
  type CountyOption,
  type RecipientState,
  type UserPickRow,
} from "../types";

const SELECT_CLS =
  "flex h-9 w-full rounded-lg border border-input bg-paper-sunken/40 px-3 py-1 text-sm transition-colors focus-visible:border-brand/60 focus-visible:bg-paper-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30";
const TEXTAREA_CLS =
  "flex min-h-20 w-full rounded-lg border border-input bg-paper-sunken/40 px-3 py-2 text-sm transition-colors placeholder:text-ink-3 focus-visible:border-brand/60 focus-visible:bg-paper-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30";

const RECIPIENTS_PAGE_SIZE = 50;

export function AnnouncementEditor({
  row,
  stats,
  initialRecipients,
  recipientsPageSize,
  initialTargetUsers,
  counties,
  heroURL,
  isSuperAdmin,
}: {
  row: AnnouncementRow;
  stats: AnnouncementStats | null;
  initialRecipients: AnnouncementRecipient[];
  recipientsPageSize: number;
  initialTargetUsers: UserPickRow[];
  counties: CountyOption[];
  heroURL: string | null;
  isSuperAdmin: boolean;
}) {
  // Content state — the live preview reads from here so every control updates
  // the pop-up card instantly.
  const [kind, setKind] = useState<AnnouncementKind>(row.kind);
  const [eyebrow, setEyebrow] = useState(row.eyebrow ?? "");
  const [title, setTitle] = useState(row.title);
  const [body, setBody] = useState(row.body);
  const [highlights, setHighlights] = useState<string[]>(row.highlights);
  const [actionKind, setActionKind] = useState<AnnouncementActionKind>(row.action_kind);
  const [actionLabel, setActionLabel] = useState(row.action_label ?? "");
  const [actionValue, setActionValue] = useState(row.action_value ?? "");
  const [dismissLabel, setDismissLabel] = useState(row.dismiss_label);
  const [style, setStyle] = useState<AnnouncementStyle>(row.style);
  const [isDismissible, setIsDismissible] = useState(row.is_dismissible);
  const [priority, setPriority] = useState(row.priority.toString());
  const [slug, setSlug] = useState(row.slug ?? "");

  // Targeting state.
  const [audienceKind, setAudienceKind] = useState<AnnouncementAudienceKind>(row.audience_kind);
  const [minVersion, setMinVersion] = useState(row.min_app_version ?? "");
  const [maxVersion, setMaxVersion] = useState(row.max_app_version ?? "");
  const [target, setTarget] = useState<AnnouncementTarget>(row.target ?? {});

  const [pending, startTransition] = useTransition();

  const patch: AnnouncementPatch = {
    slug: slug.trim() || null,
    kind,
    eyebrow,
    title,
    body,
    highlights,
    action_kind: actionKind,
    action_label: actionKind === "dismiss" ? null : actionLabel,
    action_value: actionKind === "dismiss" ? null : actionValue,
    dismiss_label: dismissLabel,
    style,
    is_dismissible: isDismissible,
    priority: priority.trim() === "" ? 0 : Number(priority),
    audience_kind: audienceKind,
    min_app_version: minVersion || null,
    max_app_version: maxVersion || null,
    target: audienceKind === "filtered" ? target : {},
  };

  function save() {
    startTransition(async () => {
      const result = await updateAnnouncement(row.id, patch);
      if (!result.ok) toast.error(result.message);
      else toast.success("Saved");
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      {/* Sticky preview + lifecycle */}
      <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <PreviewCard
          eyebrow={eyebrow}
          title={title}
          body={body}
          highlights={highlights}
          actionKind={actionKind}
          actionLabel={actionLabel}
          dismissLabel={dismissLabel}
          isDismissible={isDismissible}
          heroURL={heroURL}
        />
        <Lifecycle row={row} pending={pending} isSuperAdmin={isSuperAdmin} />
        <HeroCard row={row} heroURL={heroURL} />
      </div>

      {/* Form */}
      <div className="space-y-6">
        <Card title="Content" hint="The words + image users read in the pop-up.">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kind" hint="Groups + tints the announcement.">
              <select className={SELECT_CLS} value={kind} onChange={(e) => setKind(e.target.value as AnnouncementKind)}>
                {ANNOUNCEMENT_KINDS.map((k) => (
                  <option key={k} value={k}>{KIND_LABELS[k]}</option>
                ))}
              </select>
            </Field>
            <Field label="Priority" hint="Higher shows first when several are live.">
              <Input type="number" value={priority} onChange={(e) => setPriority(e.target.value)} />
            </Field>
          </div>
          <Field label="Eyebrow" hint="Small uppercase kicker, e.g. WHAT'S NEW · 0.1.1.">
            <Input value={eyebrow} onChange={(e) => setEyebrow(e.target.value)} placeholder="WHAT'S NEW · 0.1.1" />
          </Field>
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Body" hint="The main message.">
            <textarea className={TEXTAREA_CLS} rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
          <HighlightsEditor highlights={highlights} setHighlights={setHighlights} />
          <Field label="Slug" hint="Optional stable handle (URL-safe).">
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="whats-new-0-1-1" />
          </Field>
        </Card>

        <Card title="Action" hint="One optional call-to-action plus the dismiss control.">
          <Field label="Primary action">
            <select className={SELECT_CLS} value={actionKind} onChange={(e) => setActionKind(e.target.value as AnnouncementActionKind)}>
              {ACTION_KINDS.map((a) => (
                <option key={a} value={a}>{ACTION_KIND_LABELS[a]}</option>
              ))}
            </select>
          </Field>
          {actionKind !== "dismiss" && (
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-rule/70 bg-paper-sunken/30 p-3">
              <Field label="Button label">
                <Input value={actionLabel} onChange={(e) => setActionLabel(e.target.value)} placeholder={actionKind === "external_url" ? "Read more" : "Open"} />
              </Field>
              {actionKind === "external_url" ? (
                <Field label="URL" hint="https://…">
                  <Input value={actionValue} onChange={(e) => setActionValue(e.target.value)} placeholder="https://vestige.golf/blog" />
                </Field>
              ) : (
                <Field label="Screen" hint="Where the button takes the user.">
                  <select className={SELECT_CLS} value={actionValue} onChange={(e) => setActionValue(e.target.value)}>
                    <option value="">Select a screen…</option>
                    {DEEP_LINK_TOKENS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </Field>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dismiss label" hint="Text on the dismiss control.">
              <Input value={dismissLabel} onChange={(e) => setDismissLabel(e.target.value)} placeholder="Got it" />
            </Field>
            <Field label="Style">
              <select className={SELECT_CLS} value={style} onChange={(e) => setStyle(e.target.value as AnnouncementStyle)}>
                {STYLES.map((s) => (
                  <option key={s} value={s}>{STYLE_LABELS[s]}</option>
                ))}
              </select>
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-2">
            <input type="checkbox" checked={isDismissible} onChange={(e) => setIsDismissible(e.target.checked)} />
            Dismissible — the user can close it without acting
          </label>
        </Card>

        <Card title="Who sees it" hint="Audience + an optional app-version window applied on top.">
          <TargetingBuilder
            row={row}
            audienceKind={audienceKind}
            setAudienceKind={setAudienceKind}
            minVersion={minVersion}
            setMinVersion={setMinVersion}
            maxVersion={maxVersion}
            setMaxVersion={setMaxVersion}
            target={target}
            setTarget={setTarget}
            counties={counties}
            initialTargetUsers={initialTargetUsers}
          />
        </Card>

        <Button onClick={save} disabled={pending} className="w-full">
          {pending ? "Saving…" : "Save changes"}
        </Button>

        <RecipientsSection
          row={row}
          stats={stats}
          initialRecipients={initialRecipients}
          pageSize={recipientsPageSize}
        />
      </div>
    </div>
  );
}

// ── Live preview ────────────────────────────────────────────────────

function PreviewCard({
  eyebrow,
  title,
  body,
  highlights,
  actionKind,
  actionLabel,
  dismissLabel,
  isDismissible,
  heroURL,
}: {
  eyebrow: string;
  title: string;
  body: string;
  highlights: string[];
  actionKind: AnnouncementActionKind;
  actionLabel: string;
  dismissLabel: string;
  isDismissible: boolean;
  heroURL: string | null;
}) {
  const hasAction = actionKind !== "dismiss" && actionLabel.trim().length > 0;
  const primaryLabel = hasAction ? actionLabel : dismissLabel || "Got it";
  return (
    <section className="space-y-3 rounded-xl glass-panel p-5">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
        Live preview
      </h3>
      {/* Dimmed backdrop the app raises the card over. */}
      <div
        className="flex items-center justify-center rounded-xl p-4"
        style={{
          background:
            "radial-gradient(circle at 50% 30%, #16242F 0%, #0A1218 80%)",
        }}
      >
        {/* The pop-up card — dark glass, mint eyebrow, serif title. */}
        <div className="w-full max-w-[280px] overflow-hidden rounded-2xl border border-white/10 bg-[#101D27] shadow-2xl">
          {heroURL && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={heroURL} alt="" className="h-28 w-full object-cover" />
          )}
          <div className="space-y-3 p-5 text-[#F3F0E5]">
            {eyebrow.trim() && (
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#5BE4C3]">
                {eyebrow}
              </p>
            )}
            <p className="font-heading text-lg font-semibold leading-tight text-[#F3F0E5]">
              {title || "Untitled announcement"}
            </p>
            {body.trim() && (
              <p className="text-[13px] leading-relaxed text-[#C7D2D9]">{body}</p>
            )}
            {highlights.filter((h) => h.trim()).length > 0 && (
              <ul className="space-y-1.5">
                {highlights
                  .filter((h) => h.trim())
                  .map((h, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px] text-[#E4EBEE]">
                      <Check aria-hidden className="mt-0.5 size-3.5 shrink-0 text-[#5BE4C3]" />
                      <span>{h}</span>
                    </li>
                  ))}
              </ul>
            )}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                disabled
                className="w-full rounded-full py-2.5 text-center text-sm font-semibold text-[#0A1218]"
                style={{ background: "linear-gradient(135deg, #5BE4C3, #8FE85B)" }}
              >
                {primaryLabel}
              </button>
              {hasAction && isDismissible && (
                <button
                  type="button"
                  disabled
                  className="w-full py-1 text-center text-[13px] font-medium text-[#8FA0AB]"
                >
                  {dismissLabel || "Got it"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground">
        Approximate — the iOS card composes the same fields with the app&apos;s native styling.
      </p>
    </section>
  );
}

// ── Highlights ──────────────────────────────────────────────────────

function HighlightsEditor({
  highlights,
  setHighlights,
}: {
  highlights: string[];
  setHighlights: (h: string[]) => void;
}) {
  function update(index: number, value: string) {
    setHighlights(highlights.map((h, i) => (i === index ? value : h)));
  }
  function remove(index: number) {
    setHighlights(highlights.filter((_, i) => i !== index));
  }
  function add() {
    setHighlights([...highlights, ""]);
  }
  return (
    <Field label="Highlights" hint="The checkmark bullets — what's new, what changed.">
      <div className="space-y-2">
        {highlights.map((h, i) => (
          <div key={i} className="flex items-center gap-2">
            <Check aria-hidden className="size-4 shrink-0 text-brand" />
            <Input value={h} onChange={(e) => update(i, e.target.value)} placeholder="A new thing they'll love" />
            <Button type="button" size="icon-sm" variant="ghost" onClick={() => remove(i)} aria-label="Remove highlight">
              <X className="size-4" />
            </Button>
          </div>
        ))}
        <Button type="button" size="sm" variant="outline" onClick={add}>
          <Plus className="size-3.5" /> Add highlight
        </Button>
      </div>
    </Field>
  );
}

// ── Targeting builder ───────────────────────────────────────────────

function TargetingBuilder({
  row,
  audienceKind,
  setAudienceKind,
  minVersion,
  setMinVersion,
  maxVersion,
  setMaxVersion,
  target,
  setTarget,
  counties,
  initialTargetUsers,
}: {
  row: AnnouncementRow;
  audienceKind: AnnouncementAudienceKind;
  setAudienceKind: (a: AnnouncementAudienceKind) => void;
  minVersion: string;
  setMinVersion: (v: string) => void;
  maxVersion: string;
  setMaxVersion: (v: string) => void;
  target: AnnouncementTarget;
  setTarget: (t: AnnouncementTarget) => void;
  counties: CountyOption[];
  initialTargetUsers: UserPickRow[];
}) {
  return (
    <div className="space-y-4">
      <Field label="Audience">
        <select className={SELECT_CLS} value={audienceKind} onChange={(e) => setAudienceKind(e.target.value as AnnouncementAudienceKind)}>
          {AUDIENCE_KINDS.map((a) => (
            <option key={a} value={a}>{AUDIENCE_LABELS[a]}</option>
          ))}
        </select>
      </Field>

      {audienceKind === "filtered" && (
        <FilteredCohort target={target} setTarget={setTarget} counties={counties} />
      )}

      {audienceKind === "individuals" && (
        <IndividualsPicker row={row} initialTargetUsers={initialTargetUsers} />
      )}

      <div className="space-y-2 rounded-lg border border-rule/70 bg-paper-sunken/30 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">
          App-version window (optional)
        </p>
        <p className="text-xs text-muted-foreground/80">
          Applied on top of the audience. Marketing versions like 0.1.1. Leave blank for no bound.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Minimum version">
            <Input value={minVersion} onChange={(e) => setMinVersion(e.target.value)} placeholder="0.1.1" />
          </Field>
          <Field label="Maximum version">
            <Input value={maxVersion} onChange={(e) => setMaxVersion(e.target.value)} placeholder="0.2.0" />
          </Field>
        </div>
      </div>
    </div>
  );
}

function FilteredCohort({
  target,
  setTarget,
  counties,
}: {
  target: AnnouncementTarget;
  setTarget: (t: AnnouncementTarget) => void;
  counties: CountyOption[];
}) {
  const countyName: Record<string, string> = {};
  for (const c of counties) countyName[c.id] = c.name;
  const selectedCounties = target.home_county_ids ?? [];

  function patch(next: Partial<AnnouncementTarget>) {
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
        Cohort filters — all conditions must match
      </p>

      <TristateRow
        label="Founding member"
        value={target.is_founding_member}
        onChange={(v) => patch({ is_founding_member: v })}
      />
      <TristateRow
        label="Has logged a round"
        value={target.has_logged_round}
        onChange={(v) => patch({ has_logged_round: v })}
      />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Joined after" hint="Date.">
          <Input
            type="date"
            value={target.joined_after ?? ""}
            onChange={(e) => patch({ joined_after: e.target.value || undefined })}
          />
        </Field>
        <Field label="Joined before" hint="Date.">
          <Input
            type="date"
            value={target.joined_before ?? ""}
            onChange={(e) => patch({ joined_before: e.target.value || undefined })}
          />
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
        <p className="text-xs text-muted-foreground/80">Leave none selected to ignore privacy.</p>
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
        <select
          className={SELECT_CLS}
          value=""
          onChange={(e) => {
            if (e.target.value) toggleCounty(e.target.value);
          }}
        >
          <option value="">Add a county…</option>
          {counties
            .filter((c) => !selectedCounties.includes(c.id))
            .map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
        </select>
        <p className="text-xs text-muted-foreground/80">Leave none selected to ignore home county.</p>
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

function IndividualsPicker({
  row,
  initialTargetUsers,
}: {
  row: AnnouncementRow;
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
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
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
      const r = await setTargets(row.id, picked.map((p) => p.id));
      if (!r.ok) toast.error(r.message);
      else toast.success(`Saved ${picked.length} ${picked.length === 1 ? "person" : "people"}`);
    });
  }

  function userLabel(u: UserPickRow): string {
    return u.display_name ?? (u.username ? `@${u.username}` : u.id.slice(0, 8));
  }

  return (
    <div className="space-y-3 rounded-lg border border-rule/70 bg-paper-sunken/30 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">
        Hand-picked recipients
      </p>

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
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              runSearch();
            }
          }}
          placeholder="Search username or display name…"
          className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-3 focus:outline-none"
        />
        <button
          type="button"
          onClick={runSearch}
          disabled={searching || query.trim().length < 2}
          className="rounded-md bg-brand px-2.5 py-1 text-[11px] font-semibold text-brand-fg disabled:opacity-60"
        >
          {searching ? "…" : "Search"}
        </button>
      </div>

      {results.length > 0 && (
        <ul className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-rule/70 bg-paper-raised p-1">
          {results.map((u) => {
            const already = picked.some((p) => p.id === u.id);
            return (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => add(u)}
                  disabled={already}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-paper-sunken/60 disabled:opacity-50"
                >
                  <span className="min-w-0 truncate">
                    <span className="text-ink">{u.display_name ?? "—"}</span>
                    {u.username && <span className="ml-1 text-ink-3">@{u.username}</span>}
                  </span>
                  {already ? (
                    <Check className="size-3.5 shrink-0 text-brand" />
                  ) : (
                    <Plus className="size-3.5 shrink-0 text-ink-3" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Button type="button" size="sm" onClick={persist} disabled={saving} className="w-full">
        {saving ? "Saving…" : `Save recipient list (${picked.length})`}
      </Button>
      <p className="text-xs text-muted-foreground/80">
        The recipient list saves independently of the content form above.
      </p>
    </div>
  );
}

// ── Lifecycle ───────────────────────────────────────────────────────

function Lifecycle({
  row,
  pending,
  isSuperAdmin,
}: {
  row: AnnouncementRow;
  pending: boolean;
  isSuperAdmin: boolean;
}) {
  const [busy, start] = useTransition();
  const status = statusFor(row);
  const working = busy || pending;
  const [scheduleAt, setScheduleAt] = useState(row.published_at ? toLocalInput(row.published_at) : "");
  const [unpublishAt, setUnpublishAt] = useState(row.unpublished_at ? toLocalInput(row.unpublished_at) : "");

  function publishNow() {
    start(async () => {
      const r = await setPublishState(
        row.id,
        new Date().toISOString(),
        unpublishAt ? new Date(unpublishAt).toISOString() : null,
      );
      if (!r.ok) toast.error(r.message);
      else toast.success("Published — live in the app");
    });
  }
  function schedule() {
    if (!scheduleAt) {
      toast.error("Pick a date + time first.");
      return;
    }
    start(async () => {
      const r = await setPublishState(
        row.id,
        new Date(scheduleAt).toISOString(),
        unpublishAt ? new Date(unpublishAt).toISOString() : null,
      );
      if (!r.ok) toast.error(r.message);
      else toast.success("Scheduled");
    });
  }
  function revertToDraft() {
    start(async () => {
      const r = await setPublishState(row.id, null, null);
      if (!r.ok) toast.error(r.message);
      else toast.success("Back to draft");
    });
  }
  function archive(archived: boolean) {
    start(async () => {
      const r = await setArchived(row.id, archived);
      if (!r.ok) toast.error(r.message);
      else toast.success(archived ? "Archived" : "Restored");
    });
  }
  function destroy() {
    if (!confirm(`Delete "${row.title}" permanently? Seen / dismissed receipts are removed too. This can't be undone.`)) return;
    start(async () => {
      const r = await deleteAnnouncement(row.id);
      if (!r.ok) toast.error(r.message);
      // On success the action redirects.
    });
  }

  return (
    <section className="space-y-4 rounded-xl glass-panel p-5">
      <header className="space-y-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">Lifecycle</h3>
        <p className="text-xs text-ink-3">
          Currently <span className="font-medium text-ink-2">{STATUS_LABELS[status]}</span>.
          {status === "live" && row.unpublished_at && (
            <> Sunsets {new Date(row.unpublished_at).toLocaleString()}.</>
          )}
        </p>
      </header>

      <Button onClick={publishNow} disabled={working || status === "live"} className="w-full bg-brand text-brand-fg hover:bg-brand-deep">
        {status === "live" ? "Already live" : "Publish now"}
      </Button>

      <div className="space-y-2 border-t pt-3">
        <Label className="text-xs">Schedule</Label>
        <Input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} disabled={working} />
        <Button onClick={schedule} disabled={working || !scheduleAt} variant="outline" className="w-full">
          {status === "scheduled" ? "Update schedule" : "Schedule"}
        </Button>
      </div>

      <div className="space-y-2 border-t pt-3">
        <Label className="text-xs">Sunset (optional)</Label>
        <Input type="datetime-local" value={unpublishAt} onChange={(e) => setUnpublishAt(e.target.value)} disabled={working} />
        <p className="text-xs text-muted-foreground/80">Hides from the app when this passes. Re-publish or re-schedule to apply.</p>
      </div>

      {(status === "live" || status === "scheduled" || status === "expired") && (
        <Button onClick={revertToDraft} variant="ghost" disabled={working} className="w-full">
          Revert to draft
        </Button>
      )}

      <div className="space-y-2 border-t pt-3">
        <Label className="text-xs text-destructive">Danger zone</Label>
        {status === "archived" ? (
          <Button onClick={() => archive(false)} variant="outline" disabled={working} className="w-full">Restore</Button>
        ) : (
          <Button onClick={() => archive(true)} variant="outline" disabled={working} className="w-full">Archive</Button>
        )}
        {isSuperAdmin && (
          <Button onClick={destroy} variant="destructive" disabled={working} className="w-full">Delete permanently</Button>
        )}
      </div>
    </section>
  );
}

// ── Hero image ──────────────────────────────────────────────────────

function HeroCard({ row, heroURL }: { row: AnnouncementRow; heroURL: string | null }) {
  const [busy, start] = useTransition();
  const fileRef = useRef<HTMLInputElement | null>(null);

  function onPick(file: File) {
    start(async () => {
      const fd = new FormData();
      fd.append("hero", file);
      const r = await uploadHero(row.id, fd);
      if (!r.ok) toast.error(r.message);
      else toast.success("Hero uploaded");
    });
  }
  function remove() {
    start(async () => {
      const r = await removeHero(row.id);
      if (!r.ok) toast.error(r.message);
      else toast.success("Hero removed");
    });
  }

  return (
    <section className="space-y-2 rounded-xl glass-panel p-5">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">Hero image</h3>
      <p className="text-xs text-ink-3">
        Optional banner at the top of the card. Upload a pre-sized JPEG / PNG (wide, ~16:9).
      </p>
      <div className="aspect-video w-full overflow-hidden rounded-lg border border-rule/70 bg-paper-sunken/40">
        {heroURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={heroURL} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs uppercase tracking-wider text-muted-foreground">
            No hero
          </div>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onPick(file);
        }}
      />
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
          {heroURL ? "Replace" : "Upload"}
        </Button>
        {heroURL && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={remove}>Remove</Button>
        )}
      </div>
    </section>
  );
}

// ── Recipients ──────────────────────────────────────────────────────

function RecipientsSection({
  row,
  stats,
  initialRecipients,
  pageSize,
}: {
  row: AnnouncementRow;
  stats: AnnouncementStats | null;
  initialRecipients: AnnouncementRecipient[];
  pageSize: number;
}) {
  const [state, setState] = useState<RecipientState | "all">("all");
  const [recipients, setRecipients] = useState<AnnouncementRecipient[]>(initialRecipients);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(initialRecipients.length === pageSize);
  const [loading, startLoad] = useTransition();

  function fetchPage(nextState: RecipientState | "all", nextOffset: number, append: boolean) {
    startLoad(async () => {
      const r = await loadRecipients(row.id, nextState, nextOffset, RECIPIENTS_PAGE_SIZE);
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      const data = r.data ?? [];
      setRecipients(append ? [...recipients, ...data] : data);
      setOffset(nextOffset);
      setHasMore(data.length === RECIPIENTS_PAGE_SIZE);
    });
  }

  function changeState(nextState: RecipientState | "all") {
    setState(nextState);
    fetchPage(nextState, 0, false);
  }

  const filters: (RecipientState | "all")[] = ["all", "acted", "dismissed", "seen", "not_seen"];

  return (
    <section className="space-y-4 rounded-xl glass-panel p-5">
      <header className="space-y-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
          Who&apos;s seen it
        </h3>
        <p className="text-xs text-ink-3">
          Per-user receipts. Reach is{" "}
          {stats?.is_reach_estimate
            ? "an estimate (a version window is set — based on each user's last-seen app version)"
            : "the exact targeted set"}
          .
        </p>
      </header>

      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label={stats?.is_reach_estimate ? "Targeted (est.)" : "Targeted"} value={stats?.targeted_count} />
        <StatTile label="Seen" value={stats?.seen_count} />
        <StatTile label="Dismissed" value={stats?.dismissed_count} />
        <StatTile label="Acted" value={stats?.acted_count} />
      </div>

      {/* State filter */}
      <div className="flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => changeState(f)}
            disabled={loading}
            className={cn(
              "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition",
              state === f
                ? "border-brand/40 bg-brand/10 text-brand ring-2 ring-brand/40"
                : "border-rule/70 bg-paper-sunken/60 text-ink-2 hover:border-brand/30",
            )}
          >
            {RECIPIENT_STATE_LABELS[f]}
          </button>
        ))}
      </div>

      {recipients.length === 0 ? (
        <p className="rounded-lg border border-rule/70 p-6 text-center text-sm text-muted-foreground">
          {state === "all" ? "No receipts yet." : `Nobody in the "${RECIPIENT_STATE_LABELS[state]}" state yet.`}
        </p>
      ) : (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-lg border border-rule/70">
          {recipients.map((r) => (
            <li key={r.user_id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="min-w-0 truncate">
                <span className="text-ink">{r.display_name ?? "—"}</span>
                {r.username && <span className="ml-1 text-ink-3">@{r.username}</span>}
              </span>
              <span className="flex shrink-0 items-center gap-2 text-xs text-ink-3">
                <RecipientStateChip state={r.state} />
                {r.first_seen_at && <span>{new Date(r.first_seen_at).toLocaleDateString()}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}

      {hasMore && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => fetchPage(state, offset + RECIPIENTS_PAGE_SIZE, true)}
          className="w-full"
        >
          {loading ? "Loading…" : `Load ${RECIPIENTS_PAGE_SIZE} more`}
        </Button>
      )}
    </section>
  );
}

function StatTile({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-lg border border-rule/70 bg-paper-sunken/40 p-3">
      <p className="font-heading text-2xl font-semibold tabular-nums text-ink">{value ?? "—"}</p>
      <p className="text-[11px] uppercase tracking-wider text-ink-3">{label}</p>
    </div>
  );
}

function RecipientStateChip({ state }: { state: RecipientState }) {
  const map: Record<RecipientState, string> = {
    acted: "border-brand/40 bg-brand/10 text-brand",
    dismissed: "border-rule/70 bg-paper-sunken/70 text-ink-2",
    seen: "border-info/30 bg-info/10 text-info",
    not_seen: "border-ink-3/30 bg-ink-3/10 text-ink-3",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", map[state])}>
      {RECIPIENT_STATE_LABELS[state]}
    </span>
  );
}

// ── Small layout helpers ────────────────────────────────────────────

function Card({ title, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-xl glass-panel p-5">
      <header>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">{title}</h3>
      </header>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
