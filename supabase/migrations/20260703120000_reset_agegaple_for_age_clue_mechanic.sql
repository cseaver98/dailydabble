-- Reset Agegaple for the v3 two-photo age-gap mechanic.
--
-- This intentionally removes the old single couple-photo candidate model and
-- all existing Agegaple content. Apply to local first, then staging/prod only
-- when intentionally cutting over the game.

drop table if exists agegaple.guesses cascade;
drop table if exists agegaple.daily_puzzles cascade;
drop table if exists agegaple.puzzle_candidates cascade;
drop table if exists agegaple.images cascade;
drop table if exists agegaple.couples cascade;
drop table if exists agegaple.people cascade;

create table agegaple.people (
  id uuid primary key default gen_random_uuid(),
  wikidata_qid text unique,
  name text not null,
  birth_date date not null,
  wikipedia_title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agegaple_people_name_not_empty check (length(trim(name)) > 0)
);

create table agegaple.couples (
  id uuid primary key default gen_random_uuid(),
  person_a_id uuid not null references agegaple.people(id) on delete cascade,
  person_b_id uuid not null references agegaple.people(id) on delete cascade,
  relationship_type text not null default 'couple',
  source text,
  is_active boolean not null default true,
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agegaple_couples_distinct_people_check check (person_a_id <> person_b_id),
  constraint agegaple_couples_relationship_type_check check (
    relationship_type in ('spouse', 'couple', 'former_spouse', 'former_couple')
  ),
  constraint agegaple_couples_person_pair_uidx unique (person_a_id, person_b_id)
);

create table agegaple.images (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null default 'person',
  subject_id uuid not null references agegaple.people(id) on delete cascade,
  source text not null default 'wikimedia_commons',
  file_title text,
  image_url text not null,
  thumb_url text,
  source_page_url text,
  license text,
  license_url text,
  author text,
  attribution_text text,
  metadata_json jsonb not null default '{}'::jsonb,
  is_usable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agegaple_images_subject_type_check check (subject_type = 'person'),
  constraint agegaple_images_image_url_not_empty check (length(trim(image_url)) > 0)
);

create table agegaple.puzzle_candidates (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references agegaple.couples(id) on delete cascade,
  person_a_image_id uuid references agegaple.images(id) on delete restrict,
  person_b_image_id uuid references agegaple.images(id) on delete restrict,
  person_a_photo_year integer,
  person_b_photo_year integer,
  computed_age_gap_years numeric(7, 3) not null,
  quality_score integer not null default 0,
  status text not null default 'pending_review',
  review_notes text,
  license_verified_at timestamptz,
  reviewed_at timestamptz,
  editorial_person_a_bio text,
  editorial_person_a_bio_url text,
  editorial_person_b_bio text,
  editorial_person_b_bio_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agegaple_puzzle_candidates_status_check check (
    status in ('pending_review', 'approved', 'rejected')
  ),
  constraint agegaple_puzzle_candidates_quality_score_check check (
    quality_score between 0 and 100
  ),
  constraint agegaple_puzzle_candidates_photo_year_check check (
    (person_a_photo_year is null or person_a_photo_year between 1850 and 2200)
    and (person_b_photo_year is null or person_b_photo_year between 1850 and 2200)
  ),
  constraint agegaple_puzzle_candidates_distinct_images_check check (
    person_a_image_id is null
    or person_b_image_id is null
    or person_a_image_id <> person_b_image_id
  )
);

create table agegaple.daily_puzzles (
  id uuid primary key default gen_random_uuid(),
  puzzle_date date not null unique,
  candidate_id uuid not null references agegaple.puzzle_candidates(id) on delete cascade,
  published_at timestamptz default now(),
  created_at timestamptz not null default now()
);

create table agegaple.guesses (
  id uuid primary key default gen_random_uuid(),
  puzzle_id uuid not null references agegaple.daily_puzzles(id) on delete cascade,
  session_id text,
  guess_type text not null,
  guessed_age_gap integer,
  feedback jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint agegaple_guesses_guess_type_check check (
    guess_type = 'round'
  ),
  constraint agegaple_guesses_round_shape_check check (
    guessed_age_gap between 0 and 80
  )
);

create index agegaple_couples_person_a_idx on agegaple.couples(person_a_id);
create index agegaple_couples_person_b_idx on agegaple.couples(person_b_id);
create index agegaple_images_subject_idx on agegaple.images(subject_type, subject_id);
create index agegaple_puzzle_candidates_status_idx on agegaple.puzzle_candidates(status);
create index agegaple_puzzle_candidates_couple_idx on agegaple.puzzle_candidates(couple_id);
create index agegaple_puzzle_candidates_person_a_image_idx on agegaple.puzzle_candidates(person_a_image_id);
create index agegaple_puzzle_candidates_person_b_image_idx on agegaple.puzzle_candidates(person_b_image_id);
create index agegaple_daily_puzzles_candidate_idx on agegaple.daily_puzzles(candidate_id);
create index agegaple_guesses_puzzle_session_idx on agegaple.guesses(puzzle_id, session_id);

alter table agegaple.people enable row level security;
alter table agegaple.couples enable row level security;
alter table agegaple.images enable row level security;
alter table agegaple.puzzle_candidates enable row level security;
alter table agegaple.daily_puzzles enable row level security;
alter table agegaple.guesses enable row level security;

grant usage on schema agegaple to anon, authenticated, service_role;
grant select on agegaple.people to anon, authenticated;
grant select on agegaple.couples to anon, authenticated;
grant select on agegaple.images to anon, authenticated;
grant select on agegaple.puzzle_candidates to anon, authenticated;
grant select on agegaple.daily_puzzles to anon, authenticated;
grant all privileges on all tables in schema agegaple to service_role;
grant all privileges on all sequences in schema agegaple to service_role;

create policy "allow public read scheduled agegaple people"
  on agegaple.people
  for select
  using (
    exists (
      select 1
      from agegaple.couples c
      join agegaple.puzzle_candidates pc on pc.couple_id = c.id
      join agegaple.daily_puzzles dp on dp.candidate_id = pc.id
      where c.person_a_id = agegaple.people.id
        or c.person_b_id = agegaple.people.id
    )
  );

create policy "allow public read scheduled agegaple couples"
  on agegaple.couples
  for select
  using (
    exists (
      select 1
      from agegaple.puzzle_candidates pc
      join agegaple.daily_puzzles dp on dp.candidate_id = pc.id
      where pc.couple_id = agegaple.couples.id
    )
  );

create policy "allow public read scheduled agegaple images"
  on agegaple.images
  for select
  using (
    exists (
      select 1
      from agegaple.puzzle_candidates pc
      join agegaple.daily_puzzles dp on dp.candidate_id = pc.id
      where pc.person_a_image_id = agegaple.images.id
        or pc.person_b_image_id = agegaple.images.id
    )
  );

create policy "allow public read scheduled agegaple candidates"
  on agegaple.puzzle_candidates
  for select
  using (
    exists (
      select 1
      from agegaple.daily_puzzles dp
      where dp.candidate_id = agegaple.puzzle_candidates.id
    )
  );

create policy "allow public read agegaple daily puzzles"
  on agegaple.daily_puzzles
  for select
  using (true);
