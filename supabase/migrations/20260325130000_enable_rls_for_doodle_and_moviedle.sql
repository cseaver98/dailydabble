-- Security hardening for game schemas that were missing RLS.
-- Goal: keep server/service-role workflows working, allow safe public reads,
-- and block client-side writes.

-- Ensure schema usage remains available for API roles.
grant usage on schema doodle to anon, authenticated, service_role;
grant usage on schema moviedle to anon, authenticated, service_role;

-- Remove broad client grants before re-granting least privilege.
revoke all privileges on table doodle.puzzles from anon, authenticated;
revoke all privileges on table doodle.daily_schedule from anon, authenticated;
revoke all privileges on table doodle.guess_events from anon, authenticated;

revoke all privileges on table moviedle.movies from anon, authenticated;
revoke all privileges on table moviedle.daily_schedule from anon, authenticated;

-- Service role keeps full access for server-side admin workflows.
grant all privileges on all tables in schema doodle to service_role;
grant all privileges on all sequences in schema doodle to service_role;
grant all privileges on all tables in schema moviedle to service_role;
grant all privileges on all sequences in schema moviedle to service_role;

-- Explicitly allow read-only client access where appropriate.
grant select on table doodle.puzzles to anon, authenticated;
grant select on table doodle.daily_schedule to anon, authenticated;
grant select on table moviedle.movies to anon, authenticated;
grant select on table moviedle.daily_schedule to anon, authenticated;

alter table doodle.puzzles enable row level security;
alter table doodle.daily_schedule enable row level security;
alter table doodle.guess_events enable row level security;

alter table moviedle.movies enable row level security;
alter table moviedle.daily_schedule enable row level security;

-- Replace policies idempotently.
drop policy if exists "allow public read doodle schedule" on doodle.daily_schedule;
drop policy if exists "allow public read doodle puzzles" on doodle.puzzles;

drop policy if exists "allow public read moviedle schedule" on moviedle.daily_schedule;
drop policy if exists "allow public read moviedle movies" on moviedle.movies;

-- Public schedule rows should be visible only for today/past dates.
create policy "allow public read doodle schedule"
  on doodle.daily_schedule
  for select
  to anon, authenticated
  using (puzzle_date <= current_date);

create policy "allow public read moviedle schedule"
  on moviedle.daily_schedule
  for select
  to anon, authenticated
  using (puzzle_date <= current_date);

-- Public puzzle/movie rows are visible only when linked to published schedule rows.
create policy "allow public read doodle puzzles"
  on doodle.puzzles
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from doodle.daily_schedule ds
      where ds.puzzle_id = doodle.puzzles.id
        and ds.puzzle_date <= current_date
    )
  );

create policy "allow public read moviedle movies"
  on moviedle.movies
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from moviedle.daily_schedule ds
      where ds.movie_id = moviedle.movies.id
        and ds.puzzle_date <= current_date
    )
  );
