create schema if not exists yelple;

create table if not exists yelple.businesses (
  business_id text primary key,
  name text not null,
  city text not null,
  state text not null,
  category text not null,
  rating numeric not null,
  review_hint_1 text not null default '',
  review_hint_2 text not null default '',
  review_hint_3 text not null default '',
  source text not null default 'demo',
  created_at timestamptz not null default now()
);

create table if not exists yelple.challenges (
  challenge_date date primary key,
  business_id text not null references yelple.businesses(business_id),
  source text not null default 'demo',
  place_name text,
  city text,
  state text,
  category text,
  actual_rating numeric,
  provider_content_json jsonb,
  provider_content_expires_at timestamptz,
  created_at timestamptz not null default now(),
  refreshed_at timestamptz
);

create table if not exists yelple.guesses (
  id bigint generated always as identity primary key,
  challenge_date date not null references yelple.challenges(challenge_date),
  guessed_rating numeric not null,
  actual_rating numeric not null,
  is_correct boolean not null,
  played_at timestamptz not null default now()
);

create index if not exists idx_yelple_challenges_date_desc on yelple.challenges (challenge_date desc);
create index if not exists idx_yelple_guesses_challenge_date on yelple.guesses (challenge_date);

alter table yelple.businesses enable row level security;
alter table yelple.challenges enable row level security;
alter table yelple.guesses enable row level security;

-- Public read access for challenge/game data.
drop policy if exists "public_read_businesses" on yelple.businesses;
create policy "public_read_businesses" on yelple.businesses for select using (true);

drop policy if exists "public_read_challenges" on yelple.challenges;
create policy "public_read_challenges" on yelple.challenges for select using (true);

drop policy if exists "public_read_guesses" on yelple.guesses;
create policy "public_read_guesses" on yelple.guesses for select using (true);

-- Inserts/updates should be done by server using service-role key.
