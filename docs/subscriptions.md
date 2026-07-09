# DailyDabble+ Subscription Foundation

DailyDabble+ is scaffolded but not launched. The current product behavior stays growth-first:

- Anonymous users can complete 3 daily games before the account wall.
- Logged-in free accounts can play today's web games.
- Paid checkout is not public.
- Archive subscription access is disabled until launch flags are enabled.

## Data Model

Subscription state lives in `core.subscriptions`, separate from `core.profiles` email preferences. The internal tier is currently `plus`, while the user-facing product name is DailyDabble+.

One current row is stored per user:

- `status`: `inactive`, `trialing`, `active`, `canceled`, or `expired`
- `tier`: currently `plus`
- `source`: e.g. `manual_test`, later `stripe`
- `started_at`, `ends_at`, `trial_ends_at`

## Feature Flags

All flags default to off unless set truthy with `1`, `true`, `yes`, or `on`.

- `SUBSCRIPTIONS_ENABLED`: master launch flag for paid subscription features.
- `ARCHIVE_SUBSCRIPTIONS_ENABLED`: allows active subscribers to access subscriber archive gates when the master flag is on.
- `PREMIUM_STATS_ENABLED`: allows active subscribers to see premium stats areas when the master flag is on.
- `SUBSCRIBER_BADGES_ENABLED`: allows subscriber badges to render for active subscribers. Defaults on so test subscribers can be verified before launch.
- `SUBSCRIPTION_TEST_TOKEN`: enables production-safe test controls when supplied as the `x-subscription-test-token` header.

## Testing Subscriber State

In local development, a signed-in user can mark their own account as an active test subscriber:

```sh
curl -X POST http://localhost:3100/api/account/subscription/test \
  -H "Content-Type: application/json" \
  -d '{"active":true}'
```

To turn it off:

```sh
curl -X POST http://localhost:3100/api/account/subscription/test \
  -H "Content-Type: application/json" \
  -d '{"active":false}'
```

In production-like environments, this route returns `404` unless `SUBSCRIPTION_TEST_TOKEN` is set and the matching `x-subscription-test-token` header is included.

## Launch Path

When archive depth is ready:

1. Add billing integration, likely Stripe for web.
2. Sync billing lifecycle events into `core.subscriptions`.
3. Enable `SUBSCRIPTIONS_ENABLED`.
4. Enable `ARCHIVE_SUBSCRIPTIONS_ENABLED` and/or `PREMIUM_STATS_ENABLED` when the product copy and UI are ready.
