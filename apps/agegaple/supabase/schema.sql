-- Agegaple MVP schema

create extension if not exists pgcrypto;
create schema if not exists agegaple;
set search_path to agegaple, public;

create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  wikidata_qid text unique not null,
  name text not null,
  birth_date date,
  wikipedia_title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists couples (
  id uuid primary key default gen_random_uuid(),
  person_a_id uuid not null references people(id),
  person_b_id uuid not null references people(id),
  relationship_type text not null check (relationship_type in ('spouse', 'couple', 'former_spouse', 'former_couple')),
  source text not null default 'wikidata',
  is_active boolean,
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint couples_no_self_pair check (person_a_id <> person_b_id)
);

create table if not exists images (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('person', 'couple')),
  subject_id uuid not null,
  source text not null,
  file_title text not null,
  image_url text not null,
  thumb_url text,
  license text,
  author text,
  attribution_text text,
  metadata_json jsonb,
  is_usable boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists puzzle_candidates (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id),
  image_id uuid not null references images(id),
  computed_age_gap_years numeric(5, 2) not null,
  quality_score int not null default 0,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'approved', 'rejected')),
  review_notes text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists daily_puzzles (
  id uuid primary key default gen_random_uuid(),
  puzzle_date date not null unique,
  candidate_id uuid not null references puzzle_candidates(id),
  published_at timestamptz not null default now()
);

create table if not exists guesses (
  id uuid primary key default gen_random_uuid(),
  puzzle_id uuid not null references daily_puzzles(id),
  guess_years int not null,
  abs_error numeric(5, 2) not null,
  session_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_puzzle_candidates_status on puzzle_candidates(status);
create index if not exists idx_daily_puzzles_date on daily_puzzles(puzzle_date desc);

-- Schema grants for Supabase API roles
grant usage on schema agegaple to anon, authenticated, service_role;
grant all privileges on all tables in schema agegaple to service_role;
grant all privileges on all sequences in schema agegaple to service_role;
grant all privileges on all routines in schema agegaple to service_role;

alter default privileges in schema agegaple
  grant all on tables to service_role;
alter default privileges in schema agegaple
  grant all on sequences to service_role;
alter default privileges in schema agegaple
  grant all on routines to service_role;
