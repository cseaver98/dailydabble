# Dailydabble Hub

Hub app for daily games with anonymous per-device completion tracking.

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

3. Install and run from monorepo root:

```bash
npm install
npm run dev:hub
```

Open [http://localhost:3000](http://localhost:3000).
