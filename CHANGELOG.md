# Vestige Admin — Changelog

> Long-form decision history. The one-line summary lives in
> `CLAUDE.md §6`. New entries at the top.

---

## 2026-06-07 — Users directory: full roster, per-user detail, avatar fix

Three connected bugs on `/users`, all surfaced together ("users aren't being
picked up", "can't click into an account", "pfps don't load").

- **Full roster (RLS).** `public.users` has no admin SELECT policy — its three
  SELECT policies are own-row / `privacy = 'everyone'` / friends (per
  `Vestige-ios` `20260425200001_initial_schema.sql`). The page read users
  through the admin's anon **session** client, so it only ever saw a
  privacy-filtered *slice* (verified: an unauthenticated anon read returns 0 of
  4 prod users). New **server-only service-role** module
  `lib/supabase/admin.ts` (`createServiceClient` / `tryCreateServiceClient`,
  same key source + `server-only` guard as `lib/sync/clients.ts`) reads the
  full roster, bypassing RLS. Safe because every `(dashboard)` route already
  sits behind the layout's `requireAdmin()` gate. The directory + the sidebar
  "Users" count both read through it now (the count was undercounted too).
  Privacy-gated *writes* still go through the session client + `is_admin()`
  RPCs — service-role is reads-only here. No migration.
- **Per-user detail.** New `/users/[id]` — avatar, bio, account status, privacy,
  home club/county (name-resolved), settings (units, default round privacy,
  analytics, shake-to-feedback, onboarding, last-seen version) and a timeline
  (joined / updated / username-changed / hidden-at / id). Read-only; set-status
  / hide / outreach controls land next via the existing RPCs. Directory rows are
  now clickable links into it.
- **Avatars (storage base URL).** `lib/storage.ts` hard-pinned every avatar /
  cover / course / announcement URL to the **dev** project, but the data client
  defaults to **prod** — so every image 404'd on prod data (regression from the
  prod-default switch in #11). `resolveBase` now defaults to the active-env
  default (prod when configured), and the users pages pass an explicit
  `activeStorageBaseUrl()` for exact dev-switch parity. Verified: a prod avatar
  URL now returns `200 image/jpeg`. Fixes avatars across lists/feedback/crashes
  too. The directory also now selects `avatar_photo_id` and renders the avatar
  (it didn't before), with initials fallback.
- **Realtime.** Both pages stay `force-dynamic`, so every load reads the live DB
  fresh. True client-side websocket updates aren't possible for the full roster
  (an anon client is RLS-capped to 0, and service-role can't ship to the
  browser), so server-rendered-fresh is the correct ceiling.

`tsc` / `eslint` / `build` green. No migration.

## 2026-06-07 — Config/seed push (Phase 3) + read-only prod-view mode

- **Phase 3 — config/seed push.** `safeguard_config` (the singleton safeguarding
  thresholds) folded into `lib/sync/engine.ts` as a "Config & seed" entity —
  plain row compare + upsert by id (no UUID remapping). Surfaced in the existing
  editorial dry-run/apply (the console's separate Config stub is gone; the
  Editorial section is now "Editorial & config").
- **Read-only prod-view mode.** A quick way to see live prod data ("what's on
  users' phones") with **no relogin**. A `vestige_prod_view` cookie flips the
  dashboard into read-only prod view: page *reads* come from prod (via the prod
  service-role), while the admin gate + every write stay on dev — so it's gated
  by the existing dev session and can only ever READ prod.
  - `server.ts`: `createClient()` is now prod-view-aware (prod service-role when
    the cookie is set, else the dev session client); new `createDevClient()` is
    always-dev. `requireAdmin` + all nine write/session files
    (curated/badges/courses/feedback/lists/announcements actions, signOut,
    login, auth callback) switched to `createDevClient`.
  - TopBar `View prod` / `Exit prod view` toggle (`ProdViewToggle` +
    `setProdView` action) + a claret "Prod view · read-only" pill; a prominent
    layout banner while active.
  - Covers the direct-table surfaces (users, photos, crashes, and the editorial
    state on prod). The two `is_admin()`-gated queues (feedback, safeguarding)
    don't appear in prod view yet — that needs those read RPCs to also accept
    `service_role` (a follow-up; deliberately not rewriting live RPCs here).

`tsc` / `eslint` / `build` green. No migration.

## 2026-06-07 — Dev-only dashboard + dev→prod promotion console

Reframe (supersedes the 2026-06-06 env toggle): the dashboard is a **dev-only
workshop**. It always reads/writes the dev project — single dev login, no
toggle. Its *only* relationship to prod is the promotion console: show whether
dev and prod are in sync, and push dev→prod on demand. It never operates
against prod as a session.

- **Removed the env switch entirely** — deleted `EnvSwitch`, `MirrorBanner`,
  `env-server.ts`, the `setAdminEnv` action, the `vestige_admin_env` cookie,
  and the `assertEditableEnv` guards on the editorial actions. `server.ts` /
  `client.ts` / `middleware.ts` / `storage.ts` are now hard-wired to dev via
  `envConfig("dev")`. No per-surface routing, no double-login.
- **Promotion console (`/sync`, super_admin)** — three sections:
  - **Schema & functions** — diffs dev vs prod migrations via the
    `admin_applied_migrations` RPC on each project; flags **held** migrations
    (`prod-migration-hold.txt`); pushes via the iOS-repo `prod-deploy` GitHub
    Action (`db push` + `functions deploy`), which excludes held migrations
    server-side. Live run status polled.
  - **Editorial** — the existing curated/badge/course service-role mirror.
  - **Config/seed** — placeholder (next).
- **Sync-status chip** in the TopBar (replaces the toggle): `DEV` + schema sync
  state (in sync / N to push), linking super_admins to `/sync`.
- New libs: `lib/github/dispatch.ts` (workflow_dispatch + run polling +
  hold-list read), `lib/sync/migrations.ts` (the dev↔prod migration diff),
  `lib/sync/status.ts` (the chip summary).

Needs (Tom-actions): `SUPABASE_ACCESS_TOKEN` on the iOS repo (the other two
Supabase secrets are set) + `GITHUB_DISPATCH_TOKEN` in Vercel. `tsc` / `eslint`
/ `build` green.

## 2026-06-06 — Dev/prod env switch + editorial dev→prod mirror (`/sync`)

Two paired features that close the gap between authoring (dev) and live
TestFlight data (prod). Until now the dashboard read/wrote a single
project fixed by `NEXT_PUBLIC_SUPABASE_URL/_ANON_KEY` (dev locally), so
live user data (feedback, crashes, safeguarding, users, photos) on prod
was invisible, and editorial authored on dev (curated lists, badges)
had no way to reach prod. The hard constraint throughout: course /
county / club / badge-definition UUIDs **differ across the two
projects** (the import never sets `id`; badge defs were seeded
independently — proven: badge slug `bucket-25` is `01808dbf…` on dev,
`c25ad290…` on prod), so nothing can be copied by UUID.

### Part A — dev/prod connection switch (view/triage)

The dashboard is now environment-aware. A per-request cookie
(`vestige_admin_env`, default `dev`) selects which Supabase project
every client talks to.

- **`lib/supabase/env.ts`** — isomorphic registry (no `next/headers`, so
  it's safe in the browser bundle). Reads `NEXT_PUBLIC_SUPABASE_URL_DEV
  / _ANON_KEY_DEV / _URL_PROD / _ANON_KEY_PROD`; falls back to the
  legacy unsuffixed vars for dev so nothing breaks before the new vars
  are set. `isEnvConfigured` hides prod when it's unconfigured. Anon
  keys are public + RLS-gated, so both are safe as `NEXT_PUBLIC`.
- **`lib/supabase/env-server.ts`** (`server-only`) — `activeEnvKey()`,
  `activeEnvConfig()`, `activeStorageBase()`, and `assertEditableEnv()`
  (the editorial write guard).
- **`server.ts` / `middleware.ts` / `client.ts`** now build their client
  from the active env. Supabase auth tokens are project-ref-scoped
  (`sb-<ref>-auth-token`), so dev + prod sessions coexist — switching
  just activates the other; the first prod switch prompts a prod login.
- **`storage.ts`** — env-aware base URL. Client reads the cookie; server
  callers pass `activeStorageBase()` (added an optional `baseUrl` arg).
- **`components/admin/EnvSwitch.tsx`** + TopBar — replaced the static
  `NODE_ENV` badge with a real dev/prod toggle (claret for prod). Calls
  the new `setAdminEnv` server action and reloads. Sidebar footer +
  `/sync` nav entry are env/role aware (the entry is super_admin-only).
- **Editorial read-only on prod** — `MirrorBanner` on the curated /
  badges / courses surfaces, backed by `assertEditableEnv()` guards at
  the top of every editorial write action (defence-in-depth; prod is a
  mirror so nothing is authored there). Operational actions
  (feedback / safeguarding / users / photos, and badge grant / revoke /
  backfill which act on real users) are deliberately NOT gated.

### Part B — editorial dev→prod mirror (`/sync`, super_admin only)

A new surface that mirrors all editorial content dev→prod, remapping
every reference through natural keys, with a dry-run preview before
apply. Always runs dev→prod regardless of the viewed env.

- **`lib/sync/clients.ts`** — dev + prod **service-role** clients (read
  dev / write prod, bypassing RLS). Keys are server-only
  (`SUPABASE_SERVICE_ROLE_KEY_DEV/_PROD`), never `NEXT_PUBLIC`, never in
  the repo. `syncConfigStatus()` tells the UI what's missing.
- **`lib/sync/engine.ts`** — the mirror, in dependency order:
  1. **Course editorial overlay** — UPDATE-by-key only (matched by
     `legacy_fid` → `slug`); never inserts/deletes (the import owns
     course rows). Mirrors description / par / yards / style /
     established / type / tier / hole_count + first-time hero-photo copy.
  2. **Curated lists** — full mirror by slug (create / update / delete),
     cover blobs re-keyed + copied to the prod list id, membership
     resolved dev course id → slug → prod course id and replaced
     wholesale (unresolvable members skipped + warned).
  3. **Badge definitions** — full mirror by slug; `criteria` jsonb UUIDs
     (`course_id` / `county_id` / `curated_list_id` / `scope.county_id`)
     rewritten via natural keys (unresolvable → skip + warn, never write
     a dangling ref); art re-keyed + copied; audit columns nulled.
     **Earned-safe deletes:** `badges.definition_id` is
     `ON DELETE CASCADE`, so a delete that would wipe earned badges is
     downgraded to an archive (`is_archived = true`) + warning.
  Idempotent: a second run reports zero changes.
- **`/sync`** — super_admin gate, config-needed panel when keys are
  unset, dry-run → diff report (per-entity create / update / delete /
  archive / skip counts + capped detail rows + warnings) → Apply with an
  inline confirm.

**No migrations** — the mirror uses existing tables + service-role
direct writes (per the "iOS owns all schema" rule).

**Verified:** `tsc --noEmit`, `eslint`, and `next build` all green.

**Tom-action before the live sync/switch runs end-to-end:** (1) bootstrap
Tom (+ Jack) into prod's `admins` table as super_admin (else the prod
switch bounces to `/unauthorized`); (2) set `SUPABASE_SERVICE_ROLE_KEY_DEV
/ _PROD` (server-only) + the four `NEXT_PUBLIC_*_DEV/_PROD` URL+anon vars
in Vercel and local `.env.local`; (3) confirm the `list-covers` /
`badge-art` / `course-covers` buckets exist on prod.

## 2026-06-05 — Badges editor (`/badges`)

New editorial surface for designing the badges users earn — paired with
the iOS `badge_catalogue_for_user` work and the
`20260605140000_editorial_badge_system.sql` migration in the iOS repo
(badges moved from hardcoded enum kinds to admin-authored
`badge_definitions`).

- **Index** (`/badges`) — medallion-thumbnail cards grouped by status
  (live / draft / archived), each summarising its criteria, with a
  "+ New badge" inline create flow. Mirrors the curated-lists index.
- **Editor** (`/badges/[id]`) — sticky **live preview** (earned + locked
  + grid sizes) beside the form:
  - **Visual composer** — glyph picker over a curated SF-Symbol set (+
    free-text override for any valid symbol), theme + tier colour
    swatches, shape / effect selects, hex tint override, and optional
    custom-PNG artwork upload to the `badge-art` bucket.
  - **Editorial** — name / slug / tagline / description / how-to-earn /
    category / series key+rank / display priority / secret flag.
  - **Criteria builder** — no raw SQL: pick a type (reach a number ·
    complete a county · complete a list · play a course · manual), then
    a metric + target (+ optional county/tier/style scope) or an entity
    picker.
  - **Lifecycle** — publish / unpublish, archive, delete, an "award to
    everyone who qualifies" backfill (`admin_backfill_badge_definition`),
    and a paste-a-UUID manual grant / revoke (`admin_grant_badge` /
    `admin_revoke_badge`).
- **`components/badges/BadgeMedallion.tsx`** — an SVG medallion mirroring
  the iOS `BadgeMedallion` (same shapes, palette, tier frames, effects;
  lucide glyph map) so what's designed here is what ships.
- Sidebar gains a **Badges** entry under Editorial.
- No schema changes in this repo — the table + RPCs land in the iOS
  repo's migration (per the "iOS owns all schema" rule). That migration
  is **not yet applied** to the dev project — the editor renders but
  reads/writes need it live (Tom-action).
- TypeScript clean (`tsc --noEmit`), ESLint clean.

## 2026-05-23 — Fixed sidebar, personalised greeting, integrated tools registry

Three coupled changes that turn the shell from "static frame" into
"workbench". The sidebar stops drifting with the page, the greeting
addresses the admin by name, and every external destination lives in
one central registry surfaced both compactly in the sidebar and richly
on the overview.

### Fixed-mount sidebar

- Sidebar is `position: fixed` at `lg+`; the right column gets
  `lg:pl-64` to compensate. The nav scrolls independently inside
  `overflow-y-auto`; brand header and footer stay pinned.
- Main content is normal-flow now (no `overflow-y-auto` wrapper on
  `<main>`), so the document scroll drives the page. TopBar's
  `sticky top-0` still pins to the viewport.
- The pattern: shell is fixed furniture, content is a scrolling
  document. Less jank, less re-layout, no flicker.

### Personalised greeting

- `requireAdmin()` now fetches `display_name` + `username` from
  `public.users` (left join, nullable for admin-only auth rows
  that never finished onboarding). New `AdminUser` shape exposes
  both, plus two helpers — `adminDisplayLabel(admin)` and
  `adminInitials(admin)` — with a fallback ladder: display_name →
  @username → email local-part → "admin".
- TopBar avatar pill shows the display label as the primary line,
  with `@username` (or email) as the secondary. The hero greeting
  on the overview ("Welcome back, Tom") uses the same label.

### Central tools registry

- New `src/lib/admin/tools.ts` — typed `TOOL_GROUPS` with four
  categories: **Data**, **Observability**, **Code & docs**,
  **External**. ~20 links total, with descriptions, icons, and
  enough metadata for both compact (sidebar) and rich (overview)
  renderings.
- Sidebar tool shelf now renders the same registry, grouped by
  category, with section headers — replaces the flat 5-link list.
- Overview "Operator console" (renamed from "Operator tools")
  renders one card per group, each with a header + per-link
  description + arrow affordance. New admins discover what tools
  exist without trial and error.
- Adding a new tool now means editing one file — sidebar and
  overview both light it up.

### Categories at a glance

- **Data** — Supabase SQL editor, Table editor, Auth users,
  Storage buckets, Edge functions, Logs explorer.
- **Observability** — Sentry issues / releases / performance,
  Vercel deployments / logs.
- **Code & docs** — iOS repo, Admin repo, Marketing repo, Admin
  runbook, iOS changelog.
- **External** — Marketing site, Mapbox, App Store Connect,
  Resend.

---

## 2026-05-22 — Remove round verification surface

Followed the iOS app's 2026-05-19 decision to scrap the four-method
round verification ladder (geotag check-in, attestation, geotagged
photo, admin-verified scorecard). The iOS migration
`20260519110000_drop_verification.sql` dropped the supporting tables,
columns, enums, and RPCs; admin needed to follow suit so it stops
querying tables that no longer exist.

### Removed

- **`/scorecards` page** — entirely deleted. The
  `scorecard_review_queue` table is gone; the
  `admin_claim_scorecard_review` / `admin_approve_scorecard` /
  `admin_reject_scorecard` RPCs are gone. Manual scorecard review is
  no longer a concept.
- **Sidebar** — removed the Scorecards nav item and its
  `ClipboardCheck` icon import.
- **(dashboard)/layout.tsx** — removed the
  `scorecard_review_queue` count query and the `scorecards` key
  from the badge counts object.
- **Overview** — removed the Scorecards `OverviewCard`, the
  `ScorecardRow` type, the `scorecard_review_queue` query, and the
  `scorecards` array.
- **Photos page** — collapsed from two-axis (moderation_state ×
  verification_state) to single-axis. `photos.verification_state`
  was dropped in the same migration. Kept `moderation_state` —
  photo moderation is independent of round verification and stays.
  `photos.kind` enum lost the `scorecard` value (rows converted to
  `roundPhoto`); the page now only displays `roundPhoto` / `avatar`.

### Kept (intentional, do not confuse with round verification)

- **`/lists` + `admin_list_verification_queue()`** — this is
  *list* verification (verifying user-created collections for the
  curated catalogue), a completely separate system that survives.
- **`/safeguarding`** — the explicit replacement for round
  verification per Vestige-ios §4.6 / §6.3. Trust the user, watch
  for abuse server-side, action it out-of-sight via the safeguarding
  queue.

---

## 2026-05-22 — Atlas-aligned visual refresh + dev surfaces

Pulled the admin dashboard into the same visual family as the iOS app
(Atlas dark theme) and the marketing site (mint accent on deep paper),
and lit up the under-surfaced operator workflows so devs can see what's
actually happening in the platform without leaving the browser.

### Theme

- Rewrote `app/globals.css` so the **default palette is the iOS
  Atlas dark theme**: paper `#0E1822`, ink `#F3F0E5`, mint accent
  `#5BE4C3`, lime gradient pair `#8FE85B`, amber `#F4A85C` for
  achievement / safeguarding, claret `#E2664E` for alert.
- Default theme is now `dark` (was `system`); the cream "almanac"
  palette is kept as the `.light` alternative for editors who want
  it. England green still anchors the light mode.
- Added decorative helpers: `.surface-aurora` (mirrors the marketing
  blobs, static), `.surface-glass` (panels-on-paper glass), `.bg-topo`
  (county-fill backdrop), `.pulse-dot` (live indicator pulse), `.kbd`
  (keyboard shortcut chip).

### Navigation

- **Sidebar** picks up two new live sections — `/safeguarding` and
  `/users` — under a "People & safety" group, plus a bottom "Tools"
  shelf with external links (Supabase Studio, Sentry, iOS repo,
  Marketing site, Mapbox). Brand mark redrawn in the dark Atlas
  paint.
- **TopBar** gains the deploy ref (`NEXT_PUBLIC_VERCEL_GIT_COMMIT_*`),
  a quick-tools pill cluster for the two most-used externals, and a
  pulsing env dot.

### Overview

- Hero panel re-skinned in Atlas paper with a triple-pill summary
  (queue / safeguarding flags / feedback) and an editorial serif
  greeting.
- New "Platform health" stats strip — total users (+ this week), total
  rounds (+ last 7 days), courses with polygon-coverage %, accepted
  friendships. Attention-flag if polygon coverage < 90%.
- Queue grid expanded to six cards (List verification, Feedback,
  Safeguarding, Crashes, Scorecards, Photos), each backed by a real
  query with a 4-row preview list.
- New "Operator tools" section: polygon-coverage callout, paste-able
  SQL snippet cards, and a grid of external destinations (Supabase
  SQL editor, Sentry, runbook, iOS repo).

### New pages

- **`/safeguarding`** — read-only queue backed by the existing
  `admin_safeguarding_queue()` RPC. State filter (pending /
  reviewed_clean / reviewed_actioned / auto_expired) + kind filter
  (same_day_excess / impossible_geography / velocity_spike).
  Renders evidence JSON per flag and surfaces user account_status /
  hidden flag inline. Hide / set-status / outreach actions land
  next.
- **`/users`** — directory with `username` / `display_name` search
  (citext + ilike), `account_status` filter, status tiles
  (founding / restricted / suspended / hidden / total). Read-only;
  per-user detail with mutations lands next.

### Lit-up pages (was "Soon")

- **`/photos`** — live two-axis breakdown (moderation_state ×
  verification_state) plus a 50-row pending table. Approve / reject
  controls still gated on the open §16.13 policy decision.
- **`/scorecards`** — live `scorecard_review_queue` state tiles plus
  open-queue table. Claim / approve / reject controls will hook the
  existing `admin_claim_scorecard_review` /
  `admin_approve_scorecard` / `admin_reject_scorecard` RPCs in the
  next slice.
- **`/analytics`** — useful holding page when Metabase isn't wired:
  first-cut counts (users / rounds / photos / friendships / played
  markers / bucket list), six paste-able SQL starter queries, deep
  links to Supabase SQL + table editors. Embeds Metabase when
  `NEXT_PUBLIC_METABASE_DASHBOARD_URL` is set.

### Sidebar badges

- `(dashboard)/layout.tsx` now fetches counts for nine surfaces in
  parallel (verification, curated, courses, feedback, photos,
  scorecards, safeguarding, users, crashes-7d). All independently
  nullable — a failed query hides only the matching pip.

### Notes

- No schema changes — every new query reads existing tables or RPCs
  that already live in `Vestige-ios/supabase/migrations/`.
- TypeScript clean, ESLint clean, `next build` green.
