create schema if not exists doodle;

create table if not exists doodle.puzzles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  answer text not null,
  aliases text[] not null default '{}'::text[],
  view_box text not null,
  stage_count integer not null check (stage_count >= 1),
  path_count integer not null check (path_count >= 0),
  stages jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'used', 'rejected')),
  source_filename text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists doodle_puzzles_status_idx on doodle.puzzles (status);
create index if not exists doodle_puzzles_created_at_idx on doodle.puzzles (created_at desc);

create table if not exists doodle.daily_schedule (
  puzzle_date date primary key,
  puzzle_id uuid not null references doodle.puzzles(id) on delete restrict,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (puzzle_id)
);

create index if not exists doodle_daily_schedule_published_at_idx on doodle.daily_schedule (published_at desc);

create table if not exists doodle.guess_events (
  id bigint generated always as identity primary key,
  puzzle_date date not null,
  puzzle_id uuid not null references doodle.puzzles(id) on delete cascade,
  player_id uuid null references core.players(id) on delete set null,
  guess text not null,
  normalized_guess text not null,
  attempt_number integer not null check (attempt_number >= 1),
  is_correct boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists doodle_guess_events_puzzle_date_idx on doodle.guess_events (puzzle_date);
create index if not exists doodle_guess_events_player_idx on doodle.guess_events (player_id, created_at desc);

create or replace function doodle.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists doodle_puzzles_set_updated_at on doodle.puzzles;
create trigger doodle_puzzles_set_updated_at
before update on doodle.puzzles
for each row
execute function doodle.set_updated_at();
