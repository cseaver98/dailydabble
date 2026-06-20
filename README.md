# Dailydabble Monorepo

This repository now contains all Dailydabble apps in one workspace so UI and shared patterns can stay consistent.

Repo operating notes live in [AGENTS.md](./AGENTS.md). Read that first for game structure, admin conventions, and Supabase patterns.

## Structure

- `apps/web` - public site, homepage, and shared game routes
- `apps/admin` - admin and curation surface
- `apps/web/content/doodle` - Doodle raw, processed, preview, and review-state content
- `apps/web/scripts` - shared app-support scripts for migrated public games
- `supabase` - shared Supabase config and migrations

## Workspace Commands

Install once from repo root:

```bash
npm install
```

Run apps:

```bash
npm run dev:web
npm run dev:admin
```

Quality/build:

```bash
npm run lint
npm run build
```

Deploy shortcuts:

```bash
npm run deploy:staging:web
npm run deploy:staging:admin
npm run deploy:prod:web
npm run deploy:prod:admin
```

## App Docs

- Web app details: `apps/web/README.md`
- Game scaffolding checklist: `docs/game-app-checklist.md`

## Daily Scheduling (ET)

- Public daily puzzle auto-assignment now runs through `apps/web`.
- Admin remains its own deploy target at `admin.dailydabble.app`.
