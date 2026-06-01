# Game App Normalization Status

Last updated: 2026-05-25

## Completed
- Standardized app source layout to `src/app` + `src/lib` for non-Agegaple games.
- Standardized `@/*` path alias to `./src/*` for non-Agegaple games.
- Added `.env.example` to each game app.
- Added ESLint baseline (`lint` script + `eslint.config.mjs`) for non-Agegaple games.
- Added `next.config.mjs` baseline to non-Agegaple games.
- Aligned all game apps to Next.js `16.1.7`.

## Verified
- Production builds pass for:
  - `@dailydabble/agegaple`
  - `@dailydabble/doodle`
  - `@dailydabble/equadle`
  - `@dailydabble/moviedle`
  - `@dailydabble/sportle`
  - `@dailydabble/yeardle`

## Next (Safe)
- Add a shared lint preset package to avoid duplicated per-app ESLint config.
- Introduce optional `typecheck` scripts where TypeScript usage exists.
- Standardize scheduler wiring docs (ET midnight runbook).
