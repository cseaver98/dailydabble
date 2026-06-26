-- Backfill Agegaple tables that existed in the remote project before the
-- migration history was normalized. This keeps local `supabase db reset`
-- able to rebuild the schema from scratch.

create table if not exists agegaple.people (
  id uuid primary key default gen_random_uuid(),
  wikidata_qid text not null unique,
  name text not null,
  birth_date date,
  wikipedia_title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agegaple.couples (
  id uuid primary key default gen_random_uuid(),
  person_a_id uuid not null references agegaple.people(id) on delete cascade,
  person_b_id uuid not null references agegaple.people(id) on delete cascade,
  relationship_type text not null default 'couple',
  source text,
  is_active boolean default true,
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint couples_distinct_people_check check (person_a_id <> person_b_id),
  constraint couples_person_pair_uidx unique (person_a_id, person_b_id)
);

create table if not exists agegaple.images (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null,
  subject_id uuid not null,
  source text,
  file_title text,
  image_url text not null,
  thumb_url text,
  license text,
  author text,
  attribution_text text,
  metadata_json jsonb default '{}'::jsonb,
  is_usable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agegaple.puzzle_candidates (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references agegaple.couples(id) on delete cascade,
  image_id uuid not null references agegaple.images(id) on delete restrict,
  computed_age_gap_years numeric(7, 3) not null,
  quality_score integer not null default 0,
  status text not null default 'pending_review',
  review_notes text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agegaple.daily_puzzles (
  id uuid primary key default gen_random_uuid(),
  puzzle_date date not null unique,
  candidate_id uuid not null references agegaple.puzzle_candidates(id) on delete cascade,
  published_at timestamptz default now(),
  created_at timestamptz not null default now()
);

create table if not exists agegaple.guesses (
  id uuid primary key default gen_random_uuid(),
  puzzle_id uuid not null references agegaple.daily_puzzles(id) on delete cascade,
  player_id uuid not null references core.players(id) on delete cascade,
  guessed_age_gap integer not null,
  feedback jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agegaple_couples_person_a_idx on agegaple.couples(person_a_id);
create index if not exists agegaple_couples_person_b_idx on agegaple.couples(person_b_id);
create index if not exists agegaple_images_subject_idx on agegaple.images(subject_type, subject_id);
create index if not exists agegaple_puzzle_candidates_status_idx on agegaple.puzzle_candidates(status);
create index if not exists agegaple_puzzle_candidates_couple_idx on agegaple.puzzle_candidates(couple_id);
create index if not exists agegaple_daily_puzzles_candidate_idx on agegaple.daily_puzzles(candidate_id);
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'agegaple'
      and table_name = 'guesses'
      and column_name = 'player_id'
  ) then
    create index if not exists agegaple_guesses_puzzle_player_idx on agegaple.guesses(puzzle_id, player_id);
  end if;
end $$;

grant usage on schema agegaple to anon, authenticated, service_role;
grant select on all tables in schema agegaple to anon, authenticated;
grant all privileges on all tables in schema agegaple to service_role;
grant all privileges on all sequences in schema agegaple to service_role;
