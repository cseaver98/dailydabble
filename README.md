# Dailydabble Monorepo

This repository now contains all Dailydabble apps in one workspace so UI and shared patterns can stay consistent.

## Structure

- `apps/hub` - splash page and game status hub
- `apps/agegaple` - Agegaple game app
- `apps/yelple` - Yelple game app
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
npm run dev:yelple
```

Quality/build:

```bash
npm run lint
npm run build
```

## App Docs

- Hub details: `apps/hub/README.md`
- Agegaple details: `apps/agegaple/README.md`
- Yelple details: `apps/yelple/README.md`
