# Yelple (Next.js + Supabase)

Daily business-rating guessing game with Yelp-powered hints and archive replay.

## Stack
- Next.js (App Router)
- Supabase Postgres (`yelple` schema)
- Yelp Fusion API (optional; falls back to demo data)

## Local setup
1. Install deps
```bash
npm install
```

2. Configure env
```bash
cp .env.example .env.local
```
Fill in:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- optional `YELP_API_KEY`

3. Apply schema migration (via Supabase CLI)
```bash
supabase db push
```

4. Run app
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Routes
### Pages
- `/` play page
- `/archive`
- `/terms`
- `/privacy`

### API
- `GET /api/health`
- `GET /api/challenge/today`
- `GET /api/challenge/:date?replay=1`
- `POST /api/guess`
- `GET /api/archive?limit=120`

## Notes
- Frontend game flow and styling are preserved from the original MVP.
- Challenge provider content is cached in `challenges.provider_content_json` with TTL purge behavior.
- Server-side writes use Supabase service-role key.
