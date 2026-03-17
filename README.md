# Dailydabble Hub

Hub app for daily games (Agegaple, Yelple, etc.) with anonymous per-device completion tracking.

## Getting Started

1. Copy env values:

```bash
cp .env.example .env.local
```

2. Fill `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

3. Run dev server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Current API

- `POST /api/player`
  - Ensures anonymous `player_id` cookie exists and upserts `core.players`

- `GET /api/completions/today`
  - Returns today completion status by game for the current anonymous player

- `POST /api/completions`
  - Body:
    ```json
    {
      "gameSlug": "agegaple",
      "puzzleDate": "2026-03-16",
      "metadata": {}
    }
    ```
  - Upserts `core.completions` for the current anonymous player

## Supabase

- Uses schemas from migration in `supabase/migrations/...init_hub_core_game_schemas.sql`
- Core tables:
  - `core.players`
  - `core.completions`
