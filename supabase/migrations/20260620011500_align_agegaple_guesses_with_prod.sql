alter table if exists agegaple.guesses
  add column if not exists guess_years integer,
  add column if not exists abs_error numeric,
  add column if not exists session_id text;

alter table if exists agegaple.guesses
  alter column guess_years drop not null,
  alter column abs_error drop not null,
  alter column session_id drop not null;

drop index if exists agegaple_guesses_puzzle_player_idx;
create index if not exists agegaple_guesses_puzzle_session_idx
  on agegaple.guesses(puzzle_id, session_id);

alter table if exists agegaple.guesses
  drop column if exists player_id,
  drop column if exists guessed_age_gap,
  drop column if exists feedback;
