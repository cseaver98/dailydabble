create schema if not exists moviedle;
create extension if not exists pgcrypto;

create table if not exists moviedle.movies (
  id uuid primary key default gen_random_uuid(),
  imdb_id text,
  imdb_votes int,
  title text not null,
  title_normalized text not null unique,
  aliases text[] not null default '{}',
  aliases_normalized text[] not null default '{}',
  release_year int,
  summary text,
  lead_actors text[] not null default '{}',
  still_urls text[] not null default '{}',
  status text not null default 'pending_review',
  source text,
  review_notes text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint movies_release_year_range check (release_year is null or (release_year >= 1888 and release_year <= 2100)),
  constraint movies_still_urls_count check (cardinality(still_urls) <= 6),
  constraint movies_status_check check (status in ('pending_review', 'approved'))
);

create unique index if not exists moviedle_movies_imdb_id_key
  on moviedle.movies (imdb_id)
  where imdb_id is not null;
create index if not exists moviedle_movies_status_idx
  on moviedle.movies (status);

create table if not exists moviedle.daily_schedule (
  puzzle_date date primary key,
  movie_id uuid not null references moviedle.movies(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists moviedle_schedule_movie_id_idx on moviedle.daily_schedule (movie_id);

insert into storage.buckets (id, name, public)
values ('moviedle-stills', 'moviedle-stills', true)
on conflict (id) do update set public = excluded.public;
