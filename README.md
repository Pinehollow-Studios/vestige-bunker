# Vestige Bunker

Internal admin dashboard for Vestige — operational queues and editorial
surfaces, consuming the same Supabase backend as the iOS app with elevated
RLS. Web-only, desktop-first, Next.js + TypeScript + Tailwind + shadcn/ui,
deployed to Vercel.

The companion iOS app lives in [`Vestige-ios`](https://github.com/Pinehollow-Studios/Vestige-ios).
Anything architectural that says "see CLAUDE.md §X" refers to the iOS repo's
`CLAUDE.md` unless it's prefixed `admin §X`. This repo's `CLAUDE.md` is the
admin-side source of truth.

## Setup

```sh
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
# from the Vestige-iOS-Dev project (Supabase dashboard → Settings → API)
npm install
npm run dev
# http://localhost:3000
```

## Auth

Magic-link sign-in via Supabase. The dashboard layout calls `requireAdmin()`
which currently passes any authenticated user — the proper `admins` table
gate lands when the matching migration is added in `Vestige-ios`. Do not
deploy to a public origin until that migration is live.

## Stack

- Next.js 16 (App Router, Turbopack), React 19
- TypeScript, Tailwind 4, shadcn/ui (neutral base, Radix primitives)
- `@supabase/ssr` for server + browser clients with shared cookie session
- Vercel for hosting

## Repo conventions

- Same Conventional Commits + trunk-based branching as `Vestige-ios`
  (`<type>/<short-kebab>` → squash-merge to `main`).
- No AI/tool attribution anywhere — `Co-Authored-By` trailers, "Generated
  with…" lines, robot emojis are all forbidden, retroactively.
- Migrations stay in `Vestige-ios/supabase/migrations/`; this repo only
  reads them.
