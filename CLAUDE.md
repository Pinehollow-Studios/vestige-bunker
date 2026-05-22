# Fairways Admin — source of truth

> Single source of truth for the Fairways admin dashboard. Read in full
> before contributing. The companion iOS app's `CLAUDE.md` (in
> `Fairways-ios/`) is the source of truth for everything cross-cutting —
> data model, verification rules, hard rules, scope fences. This document
> defers to it on every shared topic.

---

## 0. Document meta

- **Scope:** the admin dashboard web app only.
- **Status:** Living document.
- **Owners:** Tom (lead) and Jack.
- **Companion docs:** `Fairways-ios/CLAUDE.md` (cross-cutting),
  `Fairways-ios/CHANGELOG.md` (decision history),
  `Fairways-ios/docs/admin-runbook.md` (current SQL-based admin workflows
  the dashboard will eventually replace).

---

## 1. What this is

A web app for Fairways operational and editorial work — list verification,
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
| Backend | Supabase (same project as iOS — `Fairways-iOS-Dev` in dev, `fairways-ios-prod` in prod) |
| Auth | Supabase magic link, gated by an `admins` table (TODO migration) |
| Hosting | Vercel |
| CI | GitHub Actions (per `Fairways-ios` §3.1) |

The iOS app is the source of all schema. This repo never writes
migrations. If a feature here needs a new column, table, or RPC, it lands
in `Fairways-ios/supabase/migrations/` first.

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

1. **No AI/tool attribution anywhere.** Same as `Fairways-ios` §3.9 — no
   `Co-Authored-By: Claude …`, no robot emojis, no "Generated with…"
   lines, retroactively. Apply to commits, PRs, code comments, docs.
2. **No git mutations without explicit instruction from Tom.** No
   proactive commits, pushes, merges, or remote operations.
3. **No migrations live here.** Schema changes belong in
   `Fairways-ios/supabase/migrations/`.
4. **No production deploys until the `admins` table gate is live.** The
   `requireAdmin` stub is a dev-only allowance.
5. **No B2B export tooling without legal sign-off** on aggregation
   thresholds (per `Fairways-ios` §12.2).

---

## 5. Changelog discipline

When a meaningful slice closes, append a one-line entry to §6 below
*and* a long-form write-up to a new `CHANGELOG.md` in this repo (mirror
the `Fairways-ios` pattern). Don't paste long-form into chat — the
canonical write-up lives on disk.

---

## 6. Changelog

- **2026-05-02** — Initial scaffold: Next.js 16 + Tailwind 4 + shadcn/ui;
  Supabase SSR clients + middleware session refresh; `(dashboard)` route
  group with sidebar shell; one live route (`/lists`) and five "Soon"
  placeholders; magic-link login; `requireAdmin` stub pending the
  `admins` table migration in `Fairways-ios`.
- **2026-05-02** — Auth gate goes live: `requireAdmin()` swapped from
  any-authenticated-user stub to a `supabase.rpc('admin_role')` call
  backed by `Fairways-ios` migration `20260502140000_admins.sql`. Three
  roles (super_admin / moderator / editor); fail-closed redirect to
  `/unauthorized` on null/error. Returned `AdminRole` rides up to the
  TopBar so future role-gated UI can branch on it. Bootstrap procedure
  documented in `Fairways-ios/docs/admin-runbook.md` → "Setup — admin
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
  `Fairways-ios/supabase/migrations/`. Long-form in `CHANGELOG.md`.
