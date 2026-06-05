# DailyDabble Agent Notes

This file is for repo-specific working rules and architecture patterns. It is not a generic coding style guide.

## Repo Shape
- `apps/` contains product apps.
- `apps/web` is the public site, homepage, and shared game surface.
- `apps/admin` is the curation surface for game ops.
- Each game app should follow the normalized pattern:
- `src/app` for routes and UI
- `src/lib` for repositories, Supabase helpers, and shared app logic
- `public/` for static assets
- `supabase/migrations/` for game-owned schema changes
- `packages/ui` contains shared nav and reusable UI primitives
- Root `supabase/migrations/` is the migration path used by the Supabase CLI for the linked remote project.

## Game App Pattern
- Treat each game as its own product surface with its own app, theme, and gameplay loop.
- Preserve shared DailyDabble conventions across games:
- route pattern: `/api/puzzle/today`, `/api/puzzle/by-date`, `/api/puzzle/archive`
- archive page at `/archive` and `/archive/[date]`
- `TODAY'S GAME` and `ARCHIVE GAME` chip language
- shared nav/menu usage from `@dailydabble/ui`
- local storage keys versioned like `game:v1:*`
- New games should be wired into:
- `apps/web/lib/games.ts`
- root `package.json` workspace scripts
- admin navigation if curation is needed

## Admin Pattern
- `apps/admin` should expose one curation page per game when that game needs editorial or scheduling control.
- Favor the same review flow used elsewhere:
- `pending_review`
- `approved`
- `finished` or derived “used/today” views where appropriate
- If a game has Supabase-backed content, admin APIs should talk directly to that game schema rather than local JSON files.

## Supabase Pattern
- Prefer one schema per game: `agegaple`, `doodle`, `equadle`, `moviedle`, `sportle`, `yeardle`, `verble`.
- Keep game-owned tables inside the game schema.
- Typical daily game schema shape:
- content table, e.g. `phrases`, `puzzles`, `events`, `athletes`
- `daily_schedule` table keyed by `puzzle_date`
- Add RLS, read policies for `anon/authenticated`, and service-role grants in migrations.
- If a new schema or table must be reachable through the Data API, ensure PostgREST exposure/config is updated through migrations when needed.
- Remote migrations are applied from root with `supabase db push`.

## Verble Notes
- Verble is the flagship phrase game.
- Current gameplay rules:
- solve a phrase one word at a time
- 6 total guesses
- full phrase miss is instant loss
- word validation and feedback should be server-side
- Dictionary source of truth is `verble.dictionary_words`.
- Phrase curation lives in `verble.phrases` and scheduling in `verble.daily_schedule`.

## Frontend Expectations
- Match established DailyDabble structure and interaction patterns unless the game intentionally needs a different mechanic.
- Reuse shared visual language where appropriate, but keep each game theme distinct.
- For local game interactions, prefer lightweight client state with server validation when correctness matters.
- Avoid shipping large validation datasets to the browser when a server lookup is more appropriate.

## Working Rules For This Repo
- Before adding a new game, read `docs/game-app-checklist.md`.
- Before large structure changes, check `docs/normalization-status.md`.
- When changing an existing game, preserve its current URLs and stored progress keys unless a migration is intentional.
- When adding migrations for a game-local app folder, also place the applied migration in root `supabase/migrations/` so the CLI can push it.
