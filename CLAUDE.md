# Vestige Admin — source of truth

> Single source of truth for the Vestige admin dashboard. Read in full
> before contributing. The companion iOS app's `CLAUDE.md` (in
> `Vestige-ios/`) is the source of truth for everything cross-cutting —
> data model, verification rules, hard rules, scope fences. This document
> defers to it on every shared topic.

---

## 0. Document meta

- **Scope:** the admin dashboard web app only.
- **Status:** Living document.
- **Owners:** Tom (lead) and Jack.
- **Companion docs:** `Vestige-ios/CLAUDE.md` (cross-cutting),
  `Vestige-ios/CHANGELOG.md` (decision history),
  `Vestige-ios/docs/admin-runbook.md` (current SQL-based admin workflows
  the dashboard will eventually replace).

---

## 1. What this is

A web app for Vestige operational and editorial work — list verification,
photo moderation, scorecard verification, feedback triage, course/curated
list editing, plus an embed of Metabase for analytics. Used primarily by
Tom and Jack on desktop. Not user-facing. Not a marketing site.

The trigger for building UI for any given workload is volume: when the
matching workflow in `docs/admin-runbook.md` is being run more than a
couple of times a week, it earns a real screen here.

---

## 2. Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| UI | React 19 + Tailwind 4 + shadcn/ui (neutral base) |
| Backend | Supabase (same project as iOS — `Vestige-iOS-Dev` in dev, `vestige-ios-prod` in prod) |
| Auth | Supabase magic link, gated by an `admins` table (TODO migration) |
| Hosting | Vercel |
| CI | GitHub Actions (per `Vestige-ios` §3.1) |

The iOS app is the source of all schema. This repo never writes
migrations. If a feature here needs a new column, table, or RPC, it lands
in `Vestige-ios/supabase/migrations/` first.

---

## 3. Architecture

### 3.1 Routing

App Router with a `(dashboard)` route group. The dashboard layout calls
`requireAdmin()` server-side; everything inside is gated. `/login`,
`/auth/callback`, and `/unauthorized` live outside the group and use the
plain root layout.

### 3.2 Auth gate

`middleware.ts` runs on every request, calls `updateSession()`, and
redirects to `/login?next=…` when there's no Supabase session.
`requireAdmin()` (server-only) is the second layer — it currently lets
any authenticated user through with a `TODO`. When the `admins` table
migration lands it gains a `is_admin(auth.uid())` check; the redirect
target on failure becomes `/unauthorized`.

### 3.3 Data access

All Supabase access goes through one of:

- `lib/supabase/server.ts` — server components, server actions, route handlers.
- `lib/supabase/client.ts` — client components only.
- `lib/supabase/middleware.ts` — middleware-only session refresh.

No bespoke fetch helpers. No client-side admin RPCs without a
`SECURITY DEFINER` function on the iOS-repo migration side that gates on
`is_admin(auth.uid())`.

### 3.4 Components

- `components/ui/*` — shadcn primitives, copy-paste, edit freely.
- `components/admin/*` — admin-specific composites (sidebar, queue tile,
  empty states).
- Pages compose these. No deep component hierarchies.

---

## 4. Hard rules

1. **No AI/tool attribution anywhere.** Same as `Vestige-ios` §3.9 — no
   `Co-Authored-By: Claude …`, no robot emojis, no "Generated with…"
   lines, retroactively. Apply to commits, PRs, code comments, docs.
2. **No git mutations without explicit instruction from Tom.** No
   proactive commits, pushes, merges, or remote operations.
3. **No migrations live here.** Schema changes belong in
   `Vestige-ios/supabase/migrations/`.
4. **No production deploys until the `admins` table gate is live.** The
   `requireAdmin` stub is a dev-only allowance.
5. **No B2B export tooling without legal sign-off** on aggregation
   thresholds (per `Vestige-ios` §12.2).

---

## 5. Changelog discipline

When a meaningful slice closes, append a one-line entry to §6 below
*and* a long-form write-up to a new `CHANGELOG.md` in this repo (mirror
the `Vestige-ios` pattern). Don't paste long-form into chat — the
canonical write-up lives on disk.

---

## 6. Changelog

- **2026-05-02** — Initial scaffold: Next.js 16 + Tailwind 4 + shadcn/ui;
  Supabase SSR clients + middleware session refresh; `(dashboard)` route
  group with sidebar shell; one live route (`/lists`) and five "Soon"
  placeholders; magic-link login; `requireAdmin` stub pending the
  `admins` table migration in `Vestige-ios`.
- **2026-05-02** — Auth gate goes live: `requireAdmin()` swapped from
  any-authenticated-user stub to a `supabase.rpc('admin_role')` call
  backed by `Vestige-ios` migration `20260502140000_admins.sql`. Three
  roles (super_admin / moderator / editor); fail-closed redirect to
  `/unauthorized` on null/error. Returned `AdminRole` rides up to the
  TopBar so future role-gated UI can branch on it. Bootstrap procedure
  documented in `Vestige-ios/docs/admin-runbook.md` → "Setup — admin
  roster".
- **2026-05-22** — Atlas-aligned visual refresh + dev surfaces:
  globals.css repainted in the iOS Atlas dark / mint palette (default
  dark; cream almanac kept as light alternative); Sidebar gains
  Safeguarding + Users sections and a "Tools" shelf; TopBar gains
  deploy ref + quick-tools cluster; Overview expanded with a Platform
  Health stats strip, six live queue cards, and an Operator Tools
  shelf; new `/safeguarding` and `/users` pages (read-only); `/photos`,
  `/scorecards`, `/analytics` lit up from "Soon" to live counts. No
  schema changes — every new query reads existing tables or RPCs from
  `Vestige-ios/supabase/migrations/`. Long-form in `CHANGELOG.md`.
- **2026-05-22** — Remove round-verification surface to follow the
  iOS app's 2026-05-19 decision (`Vestige-ios` migration
  `20260519110000_drop_verification.sql`). Deleted `/scorecards`
  page + sidebar entry + layout count; stripped the Scorecards
  `OverviewCard` from the overview; collapsed `/photos` from
  two-axis (`moderation_state` × `verification_state`) to
  single-axis since the verification column was dropped.
  `/lists` (user-list verification) and `/safeguarding` (the
  explicit replacement) are unaffected — different systems.
  Long-form in `CHANGELOG.md`.
- **2026-05-23** — Workbench polish: sidebar hard-mounted via
  `position: fixed` at `lg+` (main column gets `lg:pl-64`); nav
  scrolls independently; document scroll drives content. Greeting
  + TopBar avatar pill now address the admin by `display_name`
  (with `@username` / email local-part fallback ladder) — new
  `requireAdmin()` fetches from `public.users` via a left join, with
  helpers `adminDisplayLabel()` / `adminInitials()`. New
  `src/lib/admin/tools.ts` registry — 4 grouped categories (Data,
  Observability, Code & docs, External), ~20 links — is the single
  source of truth for external destinations; both the sidebar
  Tools shelf and the overview "Operator console" read from it.
  Long-form in `CHANGELOG.md`.
- **2026-06-05** — Badges editor (`/badges`): editorial surface for
  designing badge definitions (visual composer + criteria builder +
  lifecycle + manual grant/backfill), paired with the iOS
  `20260605140000_editorial_badge_system.sql` migration. Long-form in
  `CHANGELOG.md`.
- **2026-06-06** — Dev/prod env switch + editorial dev→prod mirror
  (`/sync`): cookie-driven env switch (`vestige_admin_env`) so the
  dashboard reads/writes dev or prod (TopBar toggle, project-scoped
  sessions coexist); editorial surfaces go read-only on prod
  (`MirrorBanner` + `assertEditableEnv()` action guards). New super_admin
  `/sync` mirrors all editorial (curated lists + badge defs + course
  editorial fields + cover/art blobs) dev→prod, remapping every
  course/county/list reference by slug (UUIDs differ across projects),
  full-mirror with earned-badge-safe deletes, dry-run preview → apply.
  Service-role keys are server-only; no migrations. Long-form in
  `CHANGELOG.md`.
- **2026-06-07** — Dev-only dashboard + dev→prod promotion console
  (supersedes the 2026-06-06 toggle): the dashboard is a dev-only
  workshop (single dev login, no switch); its only prod relationship is
  the `/sync` console — show whether dev+prod are synced and push
  dev→prod. Removed `EnvSwitch` / `MirrorBanner` / `env-server.ts` /
  `setAdminEnv` / the env cookie / `assertEditableEnv`; clients hard-wired
  to dev. Schema/migrations + functions push via the iOS-repo
  `prod-deploy` GitHub Action (held migrations excluded via
  `prod-migration-hold.txt`); editorial via the service-role mirror;
  TopBar sync-status chip. Long-form in `CHANGELOG.md`.
- **2026-06-07** — Config/seed push (Phase 3) + read-only prod-view
  mode: `safeguard_config` folded into the sync engine as a "Config &
  seed" entity (shown in the editorial dry-run/apply). New read-only
  **prod view** (`vestige_prod_view` cookie, no relogin) — page reads
  come from prod via the prod service-role while the admin gate + all
  writes stay on dev (new `createDevClient`; `createClient` is
  prod-view-aware; `requireAdmin` + every write/session file switched to
  `createDevClient`). TopBar `View prod`/`Exit` toggle + claret banner.
  Covers direct-table surfaces; the `is_admin()`-gated feedback/
  safeguarding queues are a flagged follow-up (need service_role-accepting
  RPCs). Long-form in `CHANGELOG.md`.
- **2026-06-07** — Users directory fixes: the `/users` page read the
  roster through the admin's anon session, but `public.users` has no
  admin SELECT policy (own-row / public / friends only), so it only saw
  a privacy-filtered slice. New server-only service-role module
  `lib/supabase/admin.ts` (`createServiceClient` / `tryCreateServiceClient`
  / `activeStorageBaseUrl`, gated by the layout's `requireAdmin()`) reads
  the full roster + powers the sidebar count. Added clickable rows + a
  read-only `/users/[id]` detail page. Fixed `lib/storage.ts` pinning all
  image URLs to dev while data defaults to prod (every avatar/cover
  404'd) — `resolveBase` now follows the active env. Reads-only; writes
  still use the session client + `is_admin()` RPCs. No migration.
  Long-form in `CHANGELOG.md`.
- **2026-06-08** — Feedback work-tracking layer: an admin-only pipeline
  on top of the (iOS-shared, reporter-facing) `status` so operators can
  track fixing work without changing what the reporter sees. iOS
  migration `20260608120000_feedback_admin_workflow.sql` adds a
  `work_stage` enum (superset of status with internal `backlog` /
  `needsInfo` / `fixed` / `released`; status is *derived* from it), a
  `priority` enum (low/normal/high), and revives `owner_user_id`
  (assignee, admin-constrained). New `set_work_stage` (drives status +
  notifications via `transition_status` on derived-status change, silent
  on internal moves) / `set_priority` / `set_owner` RPCs;
  `admin_feedback_queue` + `admin_feedback_thread` extended to return +
  filter the new fields. Dashboard: Stage replaces the Status control,
  + Priority + Owner pickers/filters/queue chips; owner roster via new
  service-role `lib/feedback/owners.ts`. Dev wiped to zero first;
  migration applied to dev only (prod via normal promotion). Verified
  `tsc`/`eslint`/`build` + a 14-assertion live smoke test. Long-form in
  `CHANGELOG.md`.
- **2026-06-09** — Version changelog (`/changelog`): operator-facing,
  internal-only release log wired into feedback. iOS migration
  `20260609100000_app_version_changelog.sql` adds two admin-only tables —
  `app_versions` (semver split into major/minor/patch for ordering;
  draft/released lifecycle; "current" = highest released, derived) and
  `app_version_changes` (ordered, kind-tagged lines — added/changed/improved/
  fixed/removed — each optionally linking one `feedback_reports` row). RLS
  `is_admin()`, CRUD direct-via-RLS (no RPCs), seeds `0.1`/`0.1.1`/`0.1.2`.
  Dashboard: `/changelog` list + current-version banner, `/changelog/[id]`
  editor (meta + release toggle/date + grouped change-line manager + feedback
  link picker reusing `admin_feedback_queue`). Link-only loop — a "Shipped in
  vX" chip on the feedback thread + a queue marker; no `work_stage` change on
  link. Sidebar entry + overview card. **Targets prod** (the dashboard's
  default — `createClient` reads+writes prod; the 2026-06-07 "dev-only
  workshop" wording is stale); migration ships to prod via the iOS `prod-deploy`
  action (not on the hold-list), reads degrade to "not configured" until then.
  No sync entity. Verified `tsc`/`eslint`/`build`. Long-form in `CHANGELOG.md`.
- **2026-06-09** — Feedback external/internal split: a hard line between
  dashboard-only state and reporter notifications. Only **In progress** +
  **Fixed** reach the reporter (the two surfaceable states) — each takes an
  optional attached note (In progress → admin reply; Fixed → resolution note,
  now optional). Every other stage (New / Triaged / Won't fix + legacy
  backlog/needsInfo/released/resolved) is internal: moves `work_stage` only,
  never touches reporter `status`, never notifies; the reporter sees only
  Sent → Working on it → Fixed. Won't fix is a silent internal close. iOS
  migration `20260609120000_feedback_external_internal_split.sql` rewrites
  `set_work_stage` (single authority; stops delegating to `transition_status`,
  left intact for `bulk_resolve`; `fixed⇒resolved`; one notification via the
  preference-aware `notify_user(feedback)`) — no DDL, no iOS change (iOS already
  labels `inProgress`/`resolved` "Working on it"/"Fixed" and renders reply
  bodies + the resolution note). Dashboard: `/feedback` gains Active/Done/All
  tabs (Fixed + Won't fix file into Done); side panel regrouped into "Update the
  reporter" / "Internal" / "Danger zone"; freeform tags removed; rows calmed to
  Stage + Priority + Severity; dead `transitionStatus` action removed. Ships via
  the iOS migration deploy flow; not applied here. Verified `tsc`/`eslint`/
  `build`. Long-form in `CHANGELOG.md`.
- **2026-06-09** — Changelog view mode: `/changelog` is now the full read-only
  release log (every version + its change lines grouped by added/changed/
  improved/fixed/removed, newest first, current-version banner, per-version Edit
  link); `/changelog/[id]` defaults to a read-only **View** with a View⇄Edit
  toggle (`?mode=edit`, server-rendered both ways) — the editor moved behind it.
  New shared `ChangeLinesView` + `VersionView`; "report" chips on linked lines
  deep-link to the feedback thread. No role gating (any admin can edit; View is
  just the default presentation). No schema/data change — pure UI over the
  already-seeded prod tables. Verified `tsc`/`eslint`/`build`. Long-form in
  `CHANGELOG.md`.
- **2026-06-10** — Three operator fixes: (1) the sidebar **Feedback** count now
  counts **open** tickets by active `work_stage` (`FEEDBACK_ACTIVE_WORK_STAGES`,
  matching the queue's Active tab) instead of reporter-facing `status` — which
  over-counted because a "Won't fix" closes the work_stage but leaves `status`
  open. (2) The admin **accounts get real names**: the two "branded admin login"
  super_admins (tom@ / jack@) had no `public.users` row, so each showed as a
  short id (a "number") in the owner picker / TopBar — iOS migration
  `20260610110000_admin_account_names.sql` gives them minimal `friendsOnly`
  profiles (Tom / Jack), env-guarded + idempotent. (3) The announcement
  **"who's seen it" view** raised `missing FROM-clause entry for table "t"` —
  iOS migration `20260610100000_fix_announcement_recipients_alias.sql`
  `create or replace`s `admin_announcement_recipients` aliasing the `tgt` CTE as
  `t`. Both iOS migrations deploy to prod via `prod-deploy`. Verified
  `tsc`/`eslint`/`build`. Long-form in `CHANGELOG.md`.
- **2026-06-10** — Admin names moved off `public.users`. The names fix above put
  Tom/Jack in `public.users` so a name would render — which wrongly added them
  to the **user pool**. Corrected: iOS migration
  `20260610120000_admin_display_name.sql` adds `admins.display_name` (set Tom/
  Jack) and **deletes** those two user rows (guarded by exact id + username).
  The dashboard reads the name from the admin record — `listAdminOwners` +
  `requireAdmin` coalesce `users.display_name → admins.display_name → @username
  → short id` (the `admins_select` RLS policy lets an admin session read it),
  and the feedback queue owner chip resolves from the loaded owners list so the
  row chip doesn't regress. Admin accounts are no longer users. Verified
  `tsc`/`eslint`/`build`. Long-form in `CHANGELOG.md`.
