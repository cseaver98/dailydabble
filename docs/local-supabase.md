# Local Supabase Development

DailyDabble should use a local Supabase stack for day-to-day account, auth, stats, and migration work.

## Prerequisites

- Supabase CLI
- Docker Desktop running

Check:

```bash
supabase --version
docker --version
```

## Start Local Supabase

From the repo root:

```bash
supabase start
supabase db reset
supabase status
```

`supabase db reset` applies the migrations in `supabase/migrations` and runs `supabase/seed.sql`.

## Local URLs

Default local Supabase URLs:

```text
API URL: http://127.0.0.1:54321
Studio URL: http://127.0.0.1:54323
Email inbox: http://127.0.0.1:54324
```

Magic link emails are captured in the local email inbox instead of being sent to a real inbox.

## Web App Env

For local-only development, point `apps/web/.env.local` at the local stack:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3100
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local anon key from supabase status>
SUPABASE_SECRET_KEY=<local service role key from supabase status>
LEGAL_CONTACT_EMAIL=legal@dailydabble.app
ARCHIVE_GAME_ONE_PASSWORD=<local dev password>
```

Do not commit `.env.local` files.

## Auth Redirects

Local auth is configured in `supabase/config.toml` for:

```text
http://localhost:3100/auth/callback
http://127.0.0.1:3100/auth/callback
```

## Run The App

```bash
npm run dev:web
```

Then open:

```text
http://localhost:3100
```

## Magic Link Check

1. Open the hub.
2. Click `Login`.
3. Enter an email address.
4. Click `Send magic link`.
5. Open `http://127.0.0.1:54324`.
6. Click the local email link.
7. Confirm `/api/auth/session` returns a user.

## Sync Production Data Into Local

After resetting the local database, copy a small production-shaped dataset into local:

```bash
node scripts/sync-local-prod-support-data.mjs
```

This copies:

- the first two production scheduled games for every game
- linked content rows for those scheduled games
- `verble.dictionary_words`
- `moviedle.movie_titles`

The script writes only to local Supabase. It reads production credentials from the ignored backup file created during local setup:

```text
apps/web/.env.local.remote-backup-20260620
```
