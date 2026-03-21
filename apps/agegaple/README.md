# Agegaple

Agegaple is a daily web game where players guess the age gap between celebrity couples.

This repository currently includes a lightweight MVP skeleton with:
- Public daily game page
- Admin review page
- Serverless API routes backed by Supabase
- Initial Postgres schema for Supabase

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Serverless API routes (`/api/...`)
- Supabase Postgres (schema in `supabase/schema.sql`)

## Local run

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Supabase setup

1. Create a Supabase project (or use your existing `dailydabble` project).
2. In Supabase SQL editor, run:

```sql
-- paste contents of supabase/schema.sql
```

3. Set `.env.local` values:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
SUPABASE_DB_SCHEMA=agegaple
APP_TIMEZONE=America/New_York
ADMIN_PASSWORD=...
ADMIN_AUTH_SECRET=...
```

Legacy fallback keys are also supported:

```bash
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

4. Seed initial sample data:

```bash
npm run seed
```

5. Start app:

```bash
npm run dev
```

## Current routes

- `/` public daily puzzle page
- `/admin/review` admin candidate review UI
- `/admin/login` admin login page
- `GET /api/puzzle/today` public puzzle payload (no answer)
- `POST /api/puzzle/submit` answer reveal after user guess
- `GET /api/admin/candidates` list review candidates
- `PATCH /api/admin/candidates` update candidate status
- `POST /api/admin/seed` run batch seed manually from admin
- `PATCH /api/admin/images` mark a couple image unusable from admin review
- `POST /api/admin/images` add a manual couple image URL from admin review

## Data model (planned)

SQL tables are defined in:
- `supabase/schema.sql`

Primary entities:
- `people`
- `couples`
- `images`
- `puzzle_candidates`
- `daily_puzzles`
- `guesses`

## Notes

- API routes read/write live Supabase tables through `src/lib/puzzle-repository.ts`.
- Admin routes (`/admin/*`, `/api/admin/*`) are protected by password login and an `httpOnly` signed session cookie.
- Seed script: `scripts/seed-mvp.mjs`.
- Queue flow:
  - `npm run seed` dynamically pulls couples from Wikidata relationship data (`spouse` / `partner`) and creates `pending_review` candidates.
  - Couples already used in `puzzle_candidates` are skipped, so each run prefers fresh couples.
  - Seeding still does not auto-approve photos; each new candidate is created with a non-usable placeholder image so admins can manually curate image URLs.
  - Optional seed controls: `--batch-size=1|5|10|15|20` and `--pool-size=<50..3000>` (or env `SEED_POOL_SIZE`).
  - Notability filters (defaults): `SEED_MIN_PRIMARY_SITELINKS=60` and `SEED_MIN_COMBINED_SITELINKS=120` to reduce obscure people.
  - Admin can also run manual batch seed from `/admin/review` (`1`, `5`, `10`, `15`, `20`).
  - In admin review, open a candidate photo to inspect gallery images, remove bad photos, or add manual image URLs before approval.
  - Approval is gated by usable images: candidates cannot be approved without at least one usable image.
  - Admin approves/rejects in `/admin/review`.
  - Rejected candidates are auto-deleted permanently after 24 hours (except any already referenced by `daily_puzzles`).
  - `GET /api/puzzle/today` auto-assigns today’s puzzle from the approved, unused candidate queue (no daily admin publish action required).
