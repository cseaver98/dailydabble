# Deployment Checklist

This checklist is for the unified public DailyDabble site on `dailydabble.app` plus the separate admin app on `admin.dailydabble.app`.

## Domain Map

- `apps/web` -> `dailydabble.app`
- `apps/admin` -> `admin.dailydabble.app`

## Vercel Project Setup

Create one Vercel project per app:

- `apps/web`
- `apps/admin`

For each project:

- Set the root directory to the app folder above.
- Connect the correct production domain.
- Confirm the framework is detected as Next.js.

## Environment Variables

Use each app's `.env.production` file as the source of truth:

- [apps/web/.env.production](/Users/charlesseaver/dailydabble/apps/web/.env.production)
- [apps/admin/.env.production](/Users/charlesseaver/dailydabble/apps/admin/.env.production)

Shared production values already prepared:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`

Still review before launch:

- `CRON_SECRET`
- `ADMIN_PASSWORD`
- `ADMIN_AUTH_SECRET`
- `OMDB_API_KEY`
- `LEGAL_CONTACT_EMAIL`
- `NEXT_PUBLIC_APP_URL`

## Cron-Protected Apps

`apps/web` owns the public scheduler routes for migrated games and needs `CRON_SECRET` configured.

## Supabase

Before launch:

- Confirm remote migrations are applied.
- Confirm the schema rename migration to `verble` has been applied.
- Confirm the public site is using the correct schemas:
  - `verble`
  - `agegaple`
  - `doodle`
  - `yeardle`
  - `equadle`
  - `moviedle`
  - `sportle`

## Launch Order

Recommended first deployment wave:

1. `apps/web`
2. `apps/admin`

## Smoke Test

After deployment:

1. Open `https://dailydabble.app`
2. Open `/verble`, `/agegaple`, `/doodle`, `/yeardle`, `/equadle`, `/moviedle`, and `/sportle`
3. Complete one public game and verify any shared hub/completion behavior
4. Open `https://admin.dailydabble.app`
5. Verify one admin page loads successfully

## Nice-To-Have Before Public Launch

- Add uptime monitoring for `apps/web` and `apps/admin`
- Add error monitoring
- Verify SSL on `dailydabble.app` and `admin.dailydabble.app`
- Verify archive pages on each public game route
- Manually test the scheduler endpoints in `apps/web` with the correct secret
