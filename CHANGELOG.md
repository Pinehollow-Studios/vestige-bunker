# Vestige Admin — Changelog

> Long-form decision history. The one-line summary lives in
> `CLAUDE.md §6`. New entries at the top.

---

## 2026-06-10 — Admin display names moved off public.users (admins aren't users)

The earlier same-day names fix gave the two admin-login accounts `public.users`
rows so a name would render — which dropped them into the user pool. They aren't
app users and shouldn't be. Moved the name to where admin identity belongs.

- iOS migration `20260610120000_admin_display_name.sql`: adds
  `admins.display_name` (Tom / Jack) and **deletes** the two seeded user rows
  (guarded by exact id + username, so a real user is never touched). Idempotent
  and env-safe (a no-op where those accounts don't exist).
- `listAdminOwners` + `requireAdmin` now read the name from the `admins` record,
  preferring a real `users.display_name` when an admin is also a full user
  (coalesce: `users.display_name → admins.display_name → @username → short id`).
  The pre-existing `admins_select` RLS policy already lets an admin session read
  it, so no new RPC was needed.
- The feedback queue owner chip resolves the assignee's name from the loaded
  owners list, so removing the user rows doesn't regress the row display (the
  thread already resolved owner names from that list).

Verified `tsc` / `eslint` / `next build` clean.

## 2026-06-10 — Three operator fixes (open-ticket count, admin names, announcement recipients)

- **Sidebar feedback count = open tickets.** It counted reporter-facing `status`
  (`new`/`triaged`/`inProgress`), which over-counts after the external/internal
  split: a "Won't fix" closes the `work_stage` but deliberately leaves `status`
  untouched, so closed tickets kept counting. Now counts active `work_stage`
  (`FEEDBACK_ACTIVE_WORK_STAGES`) — same definition as the queue's Active tab.
  Admin-only change (`layout.tsx`).
- **Admin accounts show names, not numbers.** Tom + Jack sign in with
  "branded admin login" accounts (both super_admin) that never onboarded, so
  they had no `public.users` row — every admin surface (feedback owner picker,
  owner chips, TopBar greeting) fell back to the short user id, e.g. `30313a69`.
  iOS migration `20260610110000_admin_account_names.sql` inserts a minimal
  `friendsOnly` profile for each (display names Tom / Jack). Env-guarded (only
  where the matching `auth.users` row exists, so it's a no-op on dev) and
  idempotent (`on conflict (id) do nothing`); the protected-columns guard passes
  migration context through. `friendsOnly` + no rounds/friends keeps them out of
  public search / feeds / leaderboards.
- **Announcement "who's seen it" view fixed.** Opening an announcement's
  recipients raised `missing FROM-clause entry for table "t"`: in
  `admin_announcement_recipients`, the `merged` CTE joined/`coalesce`d on `t.uid`
  but the targeted-users CTE is named `tgt` and was never aliased `t`. iOS
  migration `20260610100000_fix_announcement_recipients_alias.sql`
  `create or replace`s the function with `from tgt t` — otherwise verbatim.

Both iOS migrations ship to prod via the `prod-deploy` action. Verified
`tsc` / `eslint` / `next build` clean.

## 2026-06-09 — Changelog view mode (read-only viewing + View/Edit toggle)

The `/changelog` detail surface was edit-only — the only way to read a release's
notes was to stare at the editor's input fields. Added a proper read mode so
viewers (Jack) can actually read the changelog, with editing one toggle away.

- **`/changelog` is now the full read-only release log.** Every version, newest
  first, with its change lines grouped by Added / Changed / Improved / Fixed /
  Removed, the current-version banner on top — the whole history in one scroll.
  Each version links to its View page and carries a small Edit link. (Replaces
  the old compact card list, which only showed counts.)
- **Per-version View/Edit toggle.** `/changelog/[id]` defaults to a read-only
  View (release-notes layout: version, title, status, date, grouped lines); a
  View⇄Edit segmented control flips to the existing editor. Driven by a
  `?mode=edit` URL param so each mode renders server-side with fresh data (no
  stale client state when switching back from an edit). No role gating — any
  admin can edit (per Tom); View is just the default presentation.
- **Shared rendering.** New `ChangeLinesView` (grouped read-only lines, reused by
  both surfaces) + `VersionView` (single-version read). A linked change line
  shows a "report" chip deep-linking to its feedback thread, body in the tooltip.

No schema or data change — pure UI over the prod tables seeded earlier today.
Verified `tsc` / `eslint` / `next build` clean.

## 2026-06-09 — Feedback: external/internal split + attachable notifications + Done area

The work-tracking layer shipped on 2026-06-08 gave operators a finer pipeline,
but the line between *what we track* and *what the reporter is told* was fuzzy:
nine equal-weight stage pills, admin severity + freeform tags + reporter impact
all competing on the row, and several transitions (`Acknowledged`, `Closed`,
every status change) firing reporter notifications. This slice draws a hard
line and trims the noise.

- **Exactly two external indicators.** Only **In progress** and **Fixed** ever
  reach the reporter — they're the only stages that touch the reporter-facing
  `status` and the only ones that notify. Everything else (New / Triaged /
  Won't fix, plus the legacy `backlog`/`needsInfo`/`released`/`resolved`
  values) is internal: it moves `work_stage` only, never changes `status`,
  never notifies. The reporter's experience is now exactly
  **Sent → Working on it → Fixed**. Triaged and Won't fix are invisible to
  them; **Won't fix is a silent internal close** that files the report into the
  dashboard's Done area.

- **Attachable text on either action.** Clicking *In progress* / *Fixed* in the
  side panel opens an inline composer (optional message + send). The note is
  optional. On the In-progress path it's recorded as an admin **reply** (renders
  in the iOS thread + the "LATEST UPDATE" preview); on the Fixed path it's the
  **`resolution_note`** (the iOS "FIXED" card). The note was *required* on
  resolve before — it's optional now.

- **One SQL function, no DDL, no iOS change.** iOS migration
  `20260609120000_feedback_external_internal_split.sql` rewrites `set_work_stage`
  (same signature) to be the single authority for the pipeline. It stops
  delegating to `transition_status` (left intact for `bulk_resolve_reports`),
  remaps `fixed ⇒ resolved` (was `inProgress`), and owns notification policy:
  one notification per surfaceable transition, routed through the
  preference-aware `notify_user(feedback)`. No enum/column changes — it reuses
  existing `work_stage` values, the `resolution_note` column, and the reply
  mechanism. iOS already labels `inProgress` "Working on it" / `resolved`
  "Fixed" and renders reply bodies + the resolution note, so no Swift change.
  Ships via the iOS migration deploy flow (not applied from here);
  coordinated-deploy — the dashboard's `fixed⇒resolved` derivation needs the
  migration present on whichever project it reads/writes.

- **Done area.** `/feedback` gains an **Active / Done / All** segmented control
  (a `view` param mapping to a `work_stage` partition). Active (default) hides
  Fixed + Won't fix; Done is the kept record of completed work. Summary strip
  reworked to active / fixed / closed counts.

- **Rationalized internal indicators.** Side panel regrouped into "Update the
  reporter (sends a notification)" (the two external buttons), "Internal"
  (Stage = New/Triaged/Won't fix, Priority, Owner, Severity, Duplicate-of), and
  "Danger zone". **Freeform tags removed** from the workflow (the `setTags`
  action + the detail-page Tags row + the side-panel control). Queue rows
  calmed to Stage + Priority + Severity (dropped the reporter-impact chip).
  Stage filter limited to the five surfaced stages. `transitionStatus` (dead in
  the UI since the 06-08 slice) removed.

- **Verification.** `tsc` / `eslint` / `next build` green.

## 2026-06-09 — Version changelog (`/changelog`) wired into feedback

What shipped in each build of the app lived only in git + the iOS
`CHANGELOG.md`; Jack had no operator-facing view of it, and there was nothing
tying "we fixed that" to the report that surfaced it. New `/changelog` surface:
an authored, per-version release log whose change lines tag feedback reports, so
a release shows which reported bugs it tackled and a feedback thread shows the
version it shipped in.

Decisions (locked with Tom): **internal only** — no iOS consumer, no user-facing
RPC, not in the dev→prod sync engine (Announcements already covers user-facing
"what's new"); **categorized change lines** (Added / Changed / Improved / Fixed /
Removed), each optionally linking one report; **link-only loop** — tagging records
the association + shows a "Shipped in v0.1.2" badge, it does *not* move the
report's `work_stage` (no reporter notification fires on link).

- **Schema (prod).** iOS migration `20260609100000_app_version_changelog.sql` adds
  two admin-only tables — `app_versions` (semver split into `major/minor/patch`
  for correct ordering + a `draft`/`released` lifecycle; "current" is derived as
  the highest released, never stored) and `app_version_changes` (ordered,
  kind-tagged lines; `feedback_report_id` FK `on delete set null` is the loop;
  indexed for the reverse "shipped in vX" lookup). RLS `is_admin()` on both, CRUD
  direct via RLS (no RPCs — matches Announcements), shared `set_updated_at()`
  trigger. Seeds the three shipped versions (`0.1` / `0.1.1` / `0.1.2`).

- **Targets prod, not dev.** The dashboard's default + primary target is the live
  prod project (`env.ts`: reads + writes prod; `createClient` is the one
  prod-bound session client — `createDevClient` is a deprecated alias). So the
  changelog + its links are prod rows referencing prod feedback reports. Deploy
  is via the iOS-repo `prod-deploy` action (`supabase db push` against
  `vestige-ios-prod`); the migration isn't on `prod-migration-hold.txt`, so it
  applies on the next prod push. Until then every read degrades to a graceful
  "not configured" state (mirrors Announcements' `isMissingRelation`).

- **Dashboard surface.** `/changelog` lists versions newest-first with a
  prominent current-version banner; `/changelog/[id]` is the editor — version
  meta + draft↔released toggle + editable release date, plus a change-line
  manager grouped by kind with inline edit / delete / add. The report picker
  reuses the existing `admin_feedback_queue` RPC (`p_search`); linking shows the
  report inline with a deep link to its thread.

- **Feedback loop (both directions).** The thread page (`/feedback/[id]`) gains a
  brand "Shipped in v0.1.2" chip linking back to the version; the queue page
  overlays a "Shipped in vX" marker on shipped rows via one batch query keyed by
  the visible report ids.

- **Nav + overview.** Sidebar "Changelog" entry (Rocket icon, badge = in-progress
  draft count); a Changelog card on the overview Editorial row showing the
  current version + recent releases. Both counts use the same missing-table
  resilience as every other pill.

- **No sync entity.** Internal admin content authored directly in prod — nothing
  for the editorial dev→prod mirror to carry.

Verified `tsc` / `eslint` / `next build` clean (`/changelog` + `/changelog/[id]`
routes present). Migration deploy to prod is the one remaining step, handed to
Tom via the `prod-deploy` action.

## 2026-06-08 — Feedback work-tracking layer (stage + priority + owner)

The feedback queue (`/feedback`) already shipped read + triage. What was
missing for actually *working through* reports was a finer operator pipeline,
a do-next signal, and an assignee — so the open question "what am I on?" has an
answer in the UI rather than in someone's head.

- **Dev wipe first.** Cleared leftover dev feedback (1 report + 2 messages + 1
  screenshot row + the orphaned `feedback-screenshots` storage object) so dev
  starts from zero. Prod's 10 real beta reports untouched (different project).

- **Admin-only work layer (no iOS change).** `status` is shared with the iOS
  app — the reporter sees it — so the new states do **not** go on that enum.
  iOS migration `20260608120000_feedback_admin_workflow.sql` adds an admin-only
  layer that the iOS DTO never reads:
  - `work_stage` enum — the operator pipeline, a **superset** of `status` with
    four internal states (`backlog` / `needsInfo` / `fixed` / `released`). The
    reporter-facing `status` is **derived** from it:
    `backlog`/`needsInfo` ⇒ `triaged`, `fixed` ⇒ `inProgress`, `released` ⇒
    `resolved`; the five shared labels map 1:1.
  - `priority` enum (`low` / `normal` / `high`) — do-next ordering, distinct
    from admin `severity` and reporter `user_severity`. Queue now sorts
    priority-first.
  - `owner_user_id` — **revived** the column the feedback-v2 slice deprecated
    ("assigned-owner field rejected"); with two operators it earns its place
    back. Constrained to admins by `set_owner`.
  - RPCs: `set_work_stage` (the operator's one control — sets the fine stage
    and, when the *derived* status changes, delegates to `transition_status`
    so the reporter still gets the right notification + timeline entry +
    resolution note; internal-only moves like `inProgress`→`fixed` are silent),
    `set_priority`, `set_owner`. `transition_status` now keeps `work_stage` in
    sync on direct drives (e.g. `bulk_resolve`). `admin_feedback_queue` /
    `admin_feedback_thread` extended to return + filter the new fields (queue
    gains `p_work_stage_filter` / `p_priority_filter` / `p_owner_filter`; thread
    gains a resolved `owner` object). Backfill maps existing `status`→`work_stage`.

- **Dashboard.** `lib/feedback/types.ts` gains `FeedbackWorkStage` /
  `FeedbackPriority` + labels, tones, lists, and the `workStageDerivedStatus`
  mirror of the SQL derivation. New `setWorkStage` / `setPriority` / `setOwner`
  server actions. Side panel: **Stage** replaces the raw Status control (9
  pills, terminal stages prompt the resolution note, caption shows "Reporter
  sees: …"), plus **Priority** and **Owner** pickers. Queue rows show the stage
  + priority chips and the owner; filter bar swaps the redundant Status row for
  **Stage** / **Priority** / **Owner**. Owner roster comes from a new
  server-only `lib/feedback/owners.ts` (service-role read of `admins` ⋈ `users`,
  same pattern as the users directory — RLS hides admin profiles otherwise).

- **Verification.** `tsc` / `eslint` / `build` green. Plus a live end-to-end
  smoke test against dev (minted a real admin session via
  `generateLink`→`verifyOtp`, no email sent): 14/14 assertions — every
  stage→status derivation, silent internal moves, note-required gating,
  `resolved_at` set/clear on release/reopen, priority set/unset, owner
  assign / non-admin-rejection / unassign, and the anon forbidden gate. Test
  report cleaned up; dev back to zero.

- **Coordinated deploy.** Migration is applied to **dev** only and sits in the
  iOS repo for the normal prod promotion. The dashboard sends the new queue
  filters only when active, so it stays compatible with a project that predates
  the migration (e.g. prod / prod-view before its push).

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
