# Game App Checklist

Use this checklist when creating or normalizing any DailyDabble game app.

## Structure
- Use `src/` layout:
- `src/app` for routes/UI
- `src/lib` for repositories/helpers
- Keep `public/`, `supabase/`, and `scripts/` at app root

## Config Baseline
- `package.json` scripts include: `dev`, `build`, `start`, `lint`
- `jsconfig.json` (or `tsconfig.json`) uses alias:
- `@/*` -> `./src/*`
- Include `.env.example` with shared keys:
- `NEXT_PUBLIC_APP_URL`
- `APP_TIMEZONE`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`

## Layout/Branding
- `src/app/layout.*` includes:
- `title`, `description`, and `icons` metadata
- `icon`, `shortcut`, and `apple` keys pointing to app favicon
- App favicon asset in `public/favicon.svg`

## UX Consistency
- Today chip text: `TODAY'S GAME`
- Archive chip text: `ARCHIVE GAME`
- Use shared nav/menu patterns from `@dailydabble/ui`
- Use consistent unavailable-state component

## Data/API Consistency
- Keep route naming patterns aligned:
- `/api/puzzle/today`
- `/api/puzzle/by-date`
- `/api/puzzle/archive`
- Keep storage key patterns versioned (e.g. `game:v1:*`)

## Validation Before Merge
- `npm run build -w @dailydabble/<app>` passes
- `npm run lint -w @dailydabble/<app>` passes
- Manual smoke check:
- today game page
- archive page
- result dialog
