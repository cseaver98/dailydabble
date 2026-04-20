create schema if not exists sportle;
create extension if not exists pgcrypto;

create table if not exists sportle.athletes (
  id uuid primary key default gen_random_uuid(),
  sport text not null check (sport in ('nba', 'nfl', 'mlb', 'soccer', 'nhl')),
  source_key text unique,
  full_name text not null,
  full_name_normalized text not null,
  aliases text[] not null default '{}',
  aliases_normalized text[] not null default '{}',
  team_name text,
  team_logo_url text,
  years_with_team text,
  position text,
  key_stat_1 text,
  key_stat_2 text,
  final_clue text,
  wikipedia_url text,
  headshot_url text,
  is_active boolean not null default true,
  status text not null default 'pending_review' check (status in ('pending_review', 'approved')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sportle.daily_schedule (
  puzzle_date date primary key,
  athlete_id uuid not null references sportle.athletes(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists sportle_athletes_sport_name_idx on sportle.athletes (sport, full_name);
create index if not exists sportle_athletes_status_idx on sportle.athletes (status);
create index if not exists sportle_daily_schedule_athlete_id_idx on sportle.daily_schedule (athlete_id);

insert into sportle.athletes (
  source_key,
  sport,
  full_name,
  full_name_normalized,
  aliases,
  aliases_normalized,
  team_name,
  team_logo_url,
  years_with_team,
  position,
  key_stat_1,
  key_stat_2,
  final_clue,
  wikipedia_url,
  is_active
)
values (
  'nba-lebron-james',
  'nba',
  'LeBron James',
  'lebron james',
  '{"King James"}',
  '{"king james"}',
  'Los Angeles Lakers',
  'https://upload.wikimedia.org/wikipedia/commons/3/3c/Los_Angeles_Lakers_logo.svg',
  '2018-present',
  'Forward',
  '4x NBA champion and 4x MVP',
  'NBA all-time points leader',
  'Also played for the Cleveland Cavaliers and Miami Heat.',
  'https://en.wikipedia.org/wiki/LeBron_James',
  true
)
on conflict (source_key) do nothing;

insert into sportle.daily_schedule (puzzle_date, athlete_id)
select current_date, a.id
from sportle.athletes a
where a.source_key = 'nba-lebron-james'
on conflict (puzzle_date) do nothing;
