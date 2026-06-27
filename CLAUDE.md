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
- **2026-06-10** — Analytics consumption surface (Phase 3): the dashboard side
  of the app analytics programme (emit side shipped in `Vestige-ios`). Four
  `/analytics` routes (Overview · Product · B2B preview · Events) with a tab
  bar; data layer `src/lib/analytics/*` reads `app_events` + domain tables via
  the service-role client and rolls up the funnel / DAU / volume / discovery /
  B2B aggregates in code over a bounded window (`b2b_*` SQL views are the
  scaling + export follow-up). B2B preview enforces opt-out exclusion +
  `MIN_COHORT_N`=5 cohort suppression; framed internal-only (external delivery
  is Phase 4, legal-gated). Viz via hand-rolled CSS bars + a no-dep SVG
  sparkline (`src/components/admin/analytics/*`). Replaces the holding page;
  Metabase embed slot kept. No schema changes. Verified `tsc`/`eslint`/`build`.
  Long-form in `CHANGELOG.md`.
- **2026-06-10** — Analytics dashboard redesign (readability). Same-day rework
  for hierarchy after the first cut read flat/dense. Persisted **hero switcher**
  atop the overview (Pulse / Activation / Growth / Data health, saved to the
  `analytics_hero` cookie, server-read for first paint); real SVG charts
  (`AreaChart`) + `BigStat` numerals + `ProportionBar`; 4 tabs collapsed to 3
  (Product folded into Overview); B2B conversion now a headline strip on the
  overview. New helpers `getSignupSeries` / `rollupByVersion` / active-user
  windowing. No chart lib, no schema changes. Verified `tsc`/`eslint`/`build`.
  Long-form in `CHANGELOG.md`.
- **2026-06-10** — Analytics B2B + Events readability pass + nav promotion. B2B
  leads with a big conversion `BigStat` + `ProportionBar` catchment; Events gets
  a summary row + events-per-day `AreaChart` (`rollupEventsPerDay`). Moved the
  Analytics sidebar entry from the collapsed "Advanced" group into the everyday
  nav (under Overview) so it's one click for devs. Verified `tsc`/`eslint`/`build`.
- **2026-06-10** — Display font swap: **Fraunces → Manrope**, every surface.
  Tom flagged the Fraunces display serif (dashboard stat numerals + iOS
  announcement titles/hero numerals) as reading "awful / off"; picked Manrope
  (OFL geometric sans) from a rendered DM Sans / Space Grotesk / Manrope
  comparison, to apply with no misses across admin, iOS, and marketing. Admin +
  marketing: `next/font` `Fraunces`→`Manrope` on the display variable (+ sans
  fallback stack on marketing); only the display serif changed (Inter / DM Sans
  untouched). iOS: 3 static Manrope cuts instanced from the variable font
  replace the 5 Fraunces `.ttf`, `Theme.FontName.serif*` + boot assertion +
  `project.yml` `UIAppFonts` repointed, `xcodegen` regenerated, comments swept;
  no italic cut so the `editorial` role synth-obliques. Verified
  `tsc`/`eslint`/`build` (web) + iOS Debug build `BUILD SUCCEEDED` bundling
  Manrope, no Fraunces; **iOS not sim-confirmed** (WeatherKit launch denial) —
  Tom-action to eyeball. Long-form in `CHANGELOG.md` + iOS `CHANGELOG.md`.
- **2026-06-11** — Two prod feedback fixes, both closed via
  `set_work_stage('fixed')` with reporter notes: (1) iOS Home "Near you"
  card tap now opens the Atlas zoomed to that course (one-shot
  `AppState.pendingAtlasCourseFocus` consumed by the explore tab's
  search-handoff path; ships with the next build); (2) first-to-complete-
  a-county badge mints now raise a **`first_county_completion`
  safeguarding flag** (iOS migration
  `20260611100000_first_county_completion_review.sql` — velocity evidence
  inline; badge still mints, review is post-hoc) surfaced on
  `/safeguarding` (new kind chip/badge/label). Migration applied to dev;
  prod via normal `prod-deploy` promotion. Verified `tsc`/`eslint`/`build`
  + iOS Debug build. Long-form in `CHANGELOG.md` + iOS `CHANGELOG.md`.
- **2026-06-11** — Changelog workflow streamlining (dashboard-only, no
  schema): the draft lifecycle state is relabelled **In development** (was
  "In progress") with a filled amber/orange badge via shared
  `versionStatusBadgeClasses` (list + detail + editor toggle). The feedback
  link picker now loads **open** feedback immediately (new
  `listOpenFeedback` → `admin_feedback_queue` filtered to
  `FEEDBACK_ACTIVE_WORK_STAGES`, excluding already-linked reports) instead
  of a min-2-char search; the "Add change" row can tag a report **before**
  saving (prefills the line from the report body; `addChange` takes an
  optional `feedbackReportId`) and keeps the last kind + cursor after Add
  for rapid entry. New `shipReportInVersion` powers a "Ship in version"
  control on the feedback thread (one-click prefilled "Fixed" line tagged
  to the report). Changelog list gains an amber "In development — continue
  editing" banner to the active draft; overview card accent leads with
  `vX in development`. Verified `tsc`/`eslint`/`build`. Long-form in
  `CHANGELOG.md`.
- **2026-06-12** — Release-driven "Fixed" + reporter notification
  rewrite. Closes the feedback→changelog mismatch: flipping a version
  **In development → Released** now opens a confirmation modal
  (`ReleaseDialog`) listing every linked still-open report with an
  editable message + clickable pre-written resolution lines (feature
  requests lead "shipped", one line carries the version number);
  confirming bulk-marks each report Fixed via `set_work_stage` (notifying
  reporters, storing the resolution note) and releases the version in one
  gesture. New `listReportsForRelease` / `releaseVersion` actions
  (idempotent — already-resolved filtered out). The thread "Fixed" button
  relabelled **Fixed (hotfix)** (the manual exception); the thread chip
  splits **Queued for vX** (draft, amber) vs **Shipped in vX** (released,
  brand). Paired with a reporter-notification rewrite in `Vestige-ios`
  (migration `20260612100000_feedback_inprogress_notification.sql` +
  `send-apns` + Swift): new strict-allowlist kind **`feedback_in_progress`**
  fills the missing "Working on it" step (the 2026-06-10 rework had culled
  it, so In-progress fired nothing or a mislabelled reply); `set_work_stage`
  now maps each step to one kind (inProgress ⇒ feedback_in_progress, fixed
  ⇒ feedback_resolved, note-without-status ⇒ feedback_message_posted, bare
  moves silent). Verified `tsc`/`eslint`/`build` (web) + iOS Debug build
  `BUILD SUCCEEDED`. Migration ships to prod via iOS `prod-deploy`. Long-form
  in `CHANGELOG.md`.
- **2026-06-13** — Mobile navigation: the dashboard was unnavigable on a phone
  (the nav rail is `position: fixed` at `lg+`, `hidden` below — no nav at all),
  so Jack couldn't check things from the bar at his course. Lifted the nav body
  out of `Sidebar` into a shared `components/admin/nav.tsx` (`NavContent` — brand
  + everyday list + Advanced group + footer, container-agnostic, self-computing
  active state); `Sidebar` is now the `lg+` `<aside>` shell around it (still
  re-exports `BrandMark` for login/unauthorized). New `MobileNav` = a hamburger
  (`lg:hidden`) in the TopBar opening a portalled slide-in drawer (`z-50`) with
  the same `NavContent` — so the two navs can't drift. Drawer closes on link tap
  / backdrop / Escape / route change (render-time path-change reset, no effect),
  locks body scroll, `tw-animate-css` enter anims, `py-2.5` rows for touch.
  TopBar gains the trigger + `px-4 sm:px-6`; main `p-4 sm:p-6 lg:p-8`; `counts`
  flow through to the drawer pips. Scoped to navigate-and-read, not editing
  parity (heavy editors stay desktop-first); content pages already reflow. No
  schema/deps. Verified `tsc`/`eslint`/`build`; not yet device-eyeballed.
  Long-form in `CHANGELOG.md`.
- **2026-06-27** — Vestige Index normalise + county-ify + back-nav fix. The
  Index surface (shipped 2026-06-26) didn't fit the app and carried a nav bug:
  the route folder was literally named `index` → URL `/index`, which Next.js
  normalises onto `/`, colliding with Overview (shared router-cache entry → you
  kept seeing the Index after clicking Overview). **Renamed `index/` →
  `vestige-index/`** (`git mv`; repointed the sidebar `href` + the three
  `revalidatePath` calls in `courses/actions.ts`) — collision now impossible.
  Reworked `vestige-index/page.tsx` to the Courses-page shape: a county **grid**
  landing (count · avg Index · amber "N to rank" = courses still at seed
  prestige 50) drilling into a scoped ranked table. New `IndexMechanics` control
  panel (the blend formula written out, a live worked example, rarity-swing
  slider+numeric with last-tuned-by, recompute) replaces the bare
  `IndexControls`. New `IndexTable` **batch editor**: prestige + source edits
  stage locally with a live **projected Index** (`formula.ts` `projectIndex`),
  dirty pips, and a sticky "Save N changes" bar committing via the
  previously-unused batch RPC `admin_set_courses_prestige` (iOS `20260626250000`)
  through a new `setCoursesPrestige` action — one recompute per batch, not the
  per-edit O(n²) of the single-row path (kept for `/courses/[id]`). No schema
  change (every lever already existed). Verified `tsc`/`eslint`/`build`; `/index`
  gone, `/vestige-index` registered. Live UI walk-through gated behind the admin
  login (not driveable headlessly). Long-form in `CHANGELOG.md`.
- **2026-06-27** — Card-grid redesign of the list screens + Editorial/Operations
  split. Six landings still on the dense row design (`DataTable`/`<ul>`/`<ol>`)
  moved onto the app's `glass-panel` card grid: **announcements** (new
  `AnnouncementCard`), **curated lists** (new `CuratedCard` w/ cover banner),
  **societies** (new `SocietyCard` w/ crest) — old `*Table.tsx` deleted; and
  **users**, **crashes**, **safeguarding** converted in-place to responsive card
  grids (stat tiles / filters / pagination kept). The three editorial screens
  gained a **Sort** `TableSelect` to replace the lost column-header sort
  (server-side sort logic unchanged). Sidebar (`components/admin/nav.tsx`):
  **Changelog moved Editorial → Operations**; Editorial is now Jack's content
  work (Curated, Courses, Index, Badges, Announcements, Societies), Operations is
  Tom's (Feedback, Photos, Safeguarding, Crashes, List verification, Changelog);
  People/Insight/System groups kept. No schema/data change — presentation only.
  Verified `tsc`/`eslint`/`build`; UI gated behind admin login. Long-form in
  `CHANGELOG.md`.
- **2026-06-27** — Security hardening pass (full audit + fixes; new
  `SECURITY.md`). Auth foundation already solid (real `admin_role` gate, verified
  `getUser()`, fail-closed middleware, server-only secrets). Closed the gaps:
  **HTTP security headers** in `next.config.ts` (env-derived CSP scoped to
  Supabase https+wss & Mapbox, `frame-ancestors 'none'`, HSTS, X-Frame-Options
  DENY, nosniff, Referrer-/Permissions-Policy); **open redirect** in
  `auth/callback` (`safeNextPath`, `lib/security/redirect.ts`); **PostgREST
  `.or()` injection** at all sites (`lib/security/postgrest.ts`
  `sanitizeFilterValue`/`isUuid`, applied in announcements/users/crashes/
  users[id], api/search refactored); **deps → 0 vulns** (from 11/4-high — `npm
  audit fix`, Next `16.2.4→^16.2.9` closing the App-Router middleware-bypass/
  cache-poison/nonce-XSS advisories, `postcss ^8.5.10` override); **login
  brute-force** in-memory stopgap (`login/actions.ts`, per-instance — KV flagged);
  `server-only` on `lib/sentry/client.ts`; `robots.ts` disallow-all. Follow-ups
  (tracked in `SECURITY.md`): nonce-based strict CSP, KV-backed rate limiting. No
  schema/data change. Verified `tsc`/`eslint`/`build` + `npm audit` clean + login
  headers/render in-browser. Long-form in `CHANGELOG.md`.
- **2026-06-27** — Two-group sidebar + anonymous login. Sidebar
  (`components/admin/nav.tsx`) collapsed to just **Editorial** (Jack) +
  **Operations** (Tom) under the pinned Overview — People/Insight/System folded
  into Operations, reordered by expected use with **Changelog at the top**
  (Changelog · Feedback · Analytics · Photos · Safeguarding · Crashes · Users ·
  List verification · App version · Sync). Login page stripped to be invisible to
  a passer-by: removed all branding / "Vestige Admin" / "Welcome back" / admins-
  table copy / company-domain placeholder / help footer, leaving one centered
  unbranded Email+Password form. New `login/layout.tsx` overrides route metadata
  (generic title "Sign in", empty description, `robots` noindex/nofollow);
  `login/actions.ts` returns a single generic "Incorrect email or password."
  error for every failure (no email-existence / gate / rate-limit leak).
  `BrandMark` retained for `/unauthorized`. Verified visually + `tsc`/`eslint`/
  `build`. Long-form in `CHANGELOG.md`.
- **2026-06-27** — Preview/polygon/changelog/feedback QoL pass (presentation +
  layout only; no schema/data/deps). (1) **In-app preview cards rebuilt on the
  real iOS templates** — `CoursePreview` mirrors `CourseDetailSheet` (rounded
  hero → peek block w/ mint→lime **Par hero numeral** + glass details/About
  cards); `CuratedPreview` mirrors `CuratedListDetailView` (full-bleed fading
  hero + tier pill, region·tags kicker, mint-ruled bio pull-quote, glass stat
  strip, position-stamped course rows) — `CuratedEditor` now passes `region` +
  `tags`; `PreviewFrame` gained device-true chrome (Dynamic Island / status
  glyphs / home indicator). (2) **Polygon** (`PolygonPreview`) made reliable +
  foregrounded — Mapbox `auto`-bounds over satellite-streets in the mint stroke,
  5dp coord-rounding under the ~8 KB URL cap (centred-pin fallback), vertex-count
  caption; lifted into its own full-width **"Course boundary"** editor section.
  (3) **Changelog** version-meta→change-lines gap tightened (detail + list).
  (4) **Feedback** is now a fixed two-pane (`lg:h-[calc(100dvh-8rem)]`) — only the
  ticket list + thread viewer scroll, page chrome pinned. Verified `tsc`/`eslint`/
  `build` + clean dev boot; gated UI is Tom-to-eyeball. Long-form in `CHANGELOG.md`.
- **2026-06-27** — Declutter: dropped the grey helper/description text
  dashboard-wide (Tom + Jack don't need the explainers). Done at the
  shared-component level, not an ~80-site prop sweep: `EditorSection` /
  `AdvancedSection` / `Field` (`editor/EditorShell.tsx`) + the file-local `Card` /
  `Field` in `AnnouncementEditor` / `BadgeEditor` + the bespoke `AppVersionForm`
  field no longer render their `hint`; the `hint`/`subtitle` props stay on the
  *types* so all call sites still compile and the strings survive in source.
  Also removed inline prose — the App-version gate explainer, the two Sync
  `Section` subtitles, the badge-seal note. Kept the Overview mission quote,
  analytics stat captions, empty states, sync-misconfig setup steps, bell counts
  (functional, not headings). No schema/data/deps. Verified `tsc`/`eslint`/`build`
  + clean dev boot. Long-form in `CHANGELOG.md`.
