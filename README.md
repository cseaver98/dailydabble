# Dailydabble Monorepo

This repository now contains all Dailydabble apps in one workspace so UI and shared patterns can stay consistent.

## Structure

- `apps/hub` - splash page and game status hub
- `apps/agegaple` - Agegaple game app
- `supabase` - shared Supabase config and migrations

## Workspace Commands

Install once from repo root:

```bash
npm install
```

Run apps:

```bash
npm run dev:hub
npm run dev:agegaple
```

Quality/build:

```bash
npm run lint
npm run build
```

## App Docs

- Hub details: `apps/hub/README.md`
- Agegaple details: `apps/agegaple/README.md`

## Daily Scheduling (ET)

- Daily puzzle auto-assignment is triggered by Vercel cron in each game app.
- Cron schedules run at `04:05` and `05:05` UTC so midnight in `America/New_York` is covered across DST changes.
- Set `CRON_SECRET` in each Vercel project to protect `/api/internal/schedule-today`.
