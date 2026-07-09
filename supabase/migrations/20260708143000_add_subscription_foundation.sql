-- Subscription foundation for future DailyDabble+ rollout.
-- Billing is intentionally not enabled by this migration.

create extension if not exists pgcrypto;
create schema if not exists core;

create table if not exists core.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'inactive',
  tier text not null default 'plus',
  source text null,
  started_at timestamptz null,
  ends_at timestamptz null,
  trial_ends_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_status_check check (status in ('inactive', 'trialing', 'active', 'canceled', 'expired')),
  constraint subscriptions_tier_check check (tier in ('plus'))
);

create unique index if not exists subscriptions_user_id_uidx
  on core.subscriptions (user_id);

create index if not exists subscriptions_status_idx
  on core.subscriptions (status);

create or replace function core.touch_subscription_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists subscriptions_touch_updated_at on core.subscriptions;
create trigger subscriptions_touch_updated_at
before update on core.subscriptions
for each row
execute function core.touch_subscription_updated_at();

alter table core.subscriptions enable row level security;

drop policy if exists "subscriptions are readable by owner" on core.subscriptions;
create policy "subscriptions are readable by owner"
  on core.subscriptions
  for select
  to authenticated
  using (auth.uid() = user_id);

revoke all on table core.subscriptions from anon, authenticated;

grant usage on schema core to anon, authenticated, service_role;
grant select on core.subscriptions to authenticated;
grant all privileges on table core.subscriptions to service_role;
