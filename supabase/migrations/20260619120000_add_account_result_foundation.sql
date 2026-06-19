-- Account and stats foundation for DailyDabble.
-- This is additive: existing core.players/core.completions behavior stays intact.

create extension if not exists pgcrypto;
create schema if not exists core;

create table if not exists core.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  timezone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table core.players
  add column if not exists claimed_by uuid null references auth.users(id) on delete set null,
  add column if not exists claimed_at timestamptz null;

create index if not exists players_claimed_by_idx
  on core.players (claimed_by)
  where claimed_by is not null;

create table if not exists core.game_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete cascade,
  player_id uuid null references core.players(id) on delete cascade,
  game_slug text not null,
  puzzle_id text not null,
  puzzle_date date not null,
  is_archive boolean not null default false,
  is_win boolean not null,
  guesses_used integer not null check (guesses_used >= 0),
  max_guesses integer not null check (max_guesses > 0),
  completed_at timestamptz not null default now(),
  result_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint game_results_has_owner check (user_id is not null or player_id is not null)
);

create unique index if not exists game_results_user_game_date_uidx
  on core.game_results (user_id, game_slug, puzzle_date)
  where user_id is not null;

create unique index if not exists game_results_player_game_date_uidx
  on core.game_results (player_id, game_slug, puzzle_date)
  where player_id is not null;

create index if not exists game_results_user_date_idx
  on core.game_results (user_id, puzzle_date)
  where user_id is not null;

create index if not exists game_results_player_date_idx
  on core.game_results (player_id, puzzle_date)
  where player_id is not null;

create index if not exists game_results_game_date_idx
  on core.game_results (game_slug, puzzle_date);

alter table core.profiles enable row level security;
alter table core.game_results enable row level security;

create policy "profiles are readable by owner"
  on core.profiles
  for select
  to authenticated
  using (auth.uid() = id);

create policy "profiles are writable by owner"
  on core.profiles
  for all
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "game results are readable by owner"
  on core.game_results
  for select
  to authenticated
  using (auth.uid() = user_id);

revoke all on table core.profiles from anon, authenticated;
revoke all on table core.game_results from anon, authenticated;

grant usage on schema core to anon, authenticated, service_role;
grant select, insert, update, delete on core.profiles to authenticated;
grant select on core.game_results to authenticated;
grant all privileges on table core.profiles to service_role;
grant all privileges on table core.game_results to service_role;
