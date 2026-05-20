-- Migrate Equadle from 9-character equations to 8-character equations.
-- This keeps a backup of pre-migration data, removes incompatible live rows,
-- and enforces 8-char constraints going forward.

create schema if not exists equadle;

create table if not exists equadle.puzzles_pre_8char_backup (
  id uuid primary key,
  equation text not null,
  equation_length integer not null,
  status text not null,
  reviewed_at timestamptz null,
  created_at timestamptz not null
);

create table if not exists equadle.daily_schedule_pre_8char_backup (
  puzzle_date date not null,
  puzzle_id uuid not null,
  created_at timestamptz not null,
  primary key (puzzle_date, puzzle_id)
);

insert into equadle.puzzles_pre_8char_backup (id, equation, equation_length, status, reviewed_at, created_at)
select p.id, p.equation, p.equation_length, p.status, p.reviewed_at, p.created_at
from equadle.puzzles p
on conflict (id) do nothing;

insert into equadle.daily_schedule_pre_8char_backup (puzzle_date, puzzle_id, created_at)
select s.puzzle_date, s.puzzle_id, s.created_at
from equadle.daily_schedule s
on conflict (puzzle_date, puzzle_id) do nothing;

-- Remove schedule rows pointing to non-8-char puzzles.
delete from equadle.daily_schedule s
using equadle.puzzles p
where s.puzzle_id = p.id
  and char_length(p.equation) <> 8;

-- Keep only 8-char equations in the live table.
delete from equadle.puzzles
where char_length(equation) <> 8;

-- Normalize equation_length to 8 for remaining rows.
update equadle.puzzles
set equation_length = 8
where equation_length <> 8;

alter table equadle.puzzles
  alter column equation_length set default 8;

alter table equadle.puzzles
  drop constraint if exists equadle_puzzles_equation_len_chk;

alter table equadle.puzzles
  add constraint equadle_puzzles_equation_len_chk
  check (
    equation_length = 8
    and char_length(equation) = 8
  );
