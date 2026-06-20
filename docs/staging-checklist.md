# Staging Checklist

This checklist is for a protected staging environment with a separate Supabase project.

## Recommended Shape

- `apps/web` -> `staging.dailydabble.app`
- `apps/admin` -> `admin-staging.dailydabble.app`
- Separate Supabase project for staging
- Vercel protection enabled on both staging projects

## Staging Vercel Projects

Create two staging projects:

- `dailydabble-web-staging`
- `dailydabble-admin-staging`

Use these root directories:

- `apps/web`
- `apps/admin`

## Environment Files

Use these staging env files as the source of truth:

- [apps/web/.env.staging](/Users/charlesseaver/dailydabble/apps/web/.env.staging)
- [apps/admin/.env.staging](/Users/charlesseaver/dailydabble/apps/admin/.env.staging)

Important staging differences from production:

- separate Supabase URL
- separate publishable key
- separate service role key
- separate `CRON_SECRET`
- separate `ADMIN_PASSWORD`
- separate `ADMIN_AUTH_SECRET`
- separate archive unlock password if you use it
- `NEXT_PUBLIC_APP_ENV=staging` so staging is `noindex`

## Supabase

For the staging Supabase project:

1. Link the CLI to the staging project.
2. Run the shared migrations from root.
3. Recreate any required storage buckets.
4. Seed only the data you need for testing.

Suggested validation:

- confirm the `verble`, `agegaple`, `doodle`, `yeardle`, `equadle`, `moviedle`, and `sportle` schemas exist
- confirm `verble` rename migration is present
- confirm Doodle storage works
- confirm admin seed flows work against staging keys

## Vercel Protection

Before sharing staging:

- enable Vercel password or trusted-access protection
- keep search indexing off
- do not reuse production admin credentials

## Deploy Flow

Recommended Git-connected setup:

- production projects deploy from `main`
- staging projects deploy from a staging branch such as `staging`

If you keep staging on `main`, be aware it will mirror production code immediately.

## Smoke Test

After staging is live:

1. Open `https://staging.dailydabble.app`
2. Open `https://admin-staging.dailydabble.app`
3. Verify one public game route and one archive route
4. Verify admin login works
5. Verify one content curation flow
6. Verify one scheduler-protected route with the staging cron secret
