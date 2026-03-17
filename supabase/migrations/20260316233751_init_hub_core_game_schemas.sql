-- Enable UUID generation.
create extension if not exists pgcrypto;

-- Logical database separation.
create schema if not exists core;
create schema if not exists hub;
create schema if not exists yelple;
create schema if not exists agegaple;

-- Anonymous players, optionally linkable to users in the future.
create table if not exists core.players (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  is_guest boolean not null default true
);

-- Shared completion event table for all games.
create table if not exists core.completions (
  id bigint generated always as identity primary key,
  player_id uuid not null references core.players(id) on delete cascade,
  game_slug text not null,
  puzzle_date date not null,
  completed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

-- One completion per player/game/day.
create unique index if not exists completions_player_game_date_uidx
  on core.completions (player_id, game_slug, puzzle_date);

-- Read pattern for hub cards.
create index if not exists completions_player_date_idx
  on core.completions (player_id, puzzle_date);
