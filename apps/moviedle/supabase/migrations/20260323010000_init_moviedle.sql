create schema if not exists moviedle;
create extension if not exists pgcrypto;

create table if not exists moviedle.movies (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  title_normalized text not null unique,
  aliases text[] not null default '{}',
  aliases_normalized text[] not null default '{}',
  still_urls text[] not null,
  created_at timestamptz not null default now(),
  constraint movies_still_urls_count check (cardinality(still_urls) >= 1 and cardinality(still_urls) <= 6)
);

create table if not exists moviedle.daily_schedule (
  puzzle_date date primary key,
  movie_id uuid not null references moviedle.movies(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists moviedle_schedule_movie_id_idx on moviedle.daily_schedule (movie_id);

insert into storage.buckets (id, name, public)
values ('moviedle-stills', 'moviedle-stills', true)
on conflict (id) do update set public = excluded.public;
