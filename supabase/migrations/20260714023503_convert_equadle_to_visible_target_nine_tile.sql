-- Convert every Equadle puzzle in place to the visible-target 9-tile format.
-- Puzzle IDs, schedules, and aggregate game result columns remain unchanged.

alter table equadle.puzzles
  drop constraint if exists equadle_puzzles_equation_len_chk;

alter table equadle.puzzles
  alter column equation_length set default 9;

create temporary table equadle_nine_tile_pool (
  equation text primary key
) on commit drop;

insert into equadle_nine_tile_pool (equation)
with operand_sets as (
  select a, b, c
  from generate_series(10, 99) as a
  cross join generate_series(1, 9) as b
  cross join generate_series(1, 9) as c
  union all
  select a, b, c
  from generate_series(1, 9) as a
  cross join generate_series(10, 99) as b
  cross join generate_series(1, 9) as c
  union all
  select a, b, c
  from generate_series(1, 9) as a
  cross join generate_series(1, 9) as b
  cross join generate_series(10, 99) as c
),
operators as (
  select op1, op2
  from (values ('+'), ('-'), ('*')) as first_operator(op1)
  cross join (values ('+'), ('-'), ('*')) as second_operator(op2)
),
evaluated as (
  select
    operands.a,
    operands.b,
    operands.c,
    operators.op1,
    operators.op2,
    case
      when operators.op2 = '*' and operators.op1 = '+' then operands.a + (operands.b * operands.c)
      when operators.op2 = '*' and operators.op1 = '-' then operands.a - (operands.b * operands.c)
      when operators.op1 = '+' and operators.op2 = '+' then (operands.a + operands.b) + operands.c
      when operators.op1 = '+' and operators.op2 = '-' then (operands.a + operands.b) - operands.c
      when operators.op1 = '-' and operators.op2 = '+' then (operands.a - operands.b) + operands.c
      when operators.op1 = '-' and operators.op2 = '-' then (operands.a - operands.b) - operands.c
      when operators.op1 = '*' and operators.op2 = '+' then (operands.a * operands.b) + operands.c
      when operators.op1 = '*' and operators.op2 = '-' then (operands.a * operands.b) - operands.c
      when operators.op1 = '*' and operators.op2 = '*' then (operands.a * operands.b) * operands.c
    end as target
  from operand_sets operands
  cross join operators
),
candidates as (
  select format('%s%s%s%s%s=%s', a, op1, b, op2, c, target) as equation
  from evaluated
  where target between 10 and 99
)
select distinct equation
from candidates
where char_length(equation) = 9;

do $$
declare
  puzzle_count integer;
  candidate_count integer;
begin
  select count(*) into puzzle_count from equadle.puzzles;
  select count(*) into candidate_count from equadle_nine_tile_pool;

  if candidate_count < puzzle_count then
    raise exception 'Not enough unique 9-tile Equadle equations: % candidates for % puzzles', candidate_count, puzzle_count;
  end if;
end $$;

with ranked_puzzles as (
  select id, row_number() over (order by created_at, id) as row_number
  from equadle.puzzles
),
ranked_equations as (
  select equation, row_number() over (order by md5(equation)) as row_number
  from equadle_nine_tile_pool
),
replacements as (
  select puzzles.id, equations.equation
  from ranked_puzzles puzzles
  join ranked_equations equations using (row_number)
)
update equadle.puzzles puzzles
set
  equation = replacements.equation,
  equation_length = 9
from replacements
where puzzles.id = replacements.id;

alter table equadle.puzzles
  add constraint equadle_puzzles_equation_len_chk
  check (
    equation_length = 9
    and char_length(equation) = 9
    and split_part(equation, '=', 2) ~ '^[0-9]{2}$'
  );

-- Old attempt tiles cannot describe a replacement equation. Keep ownership,
-- dates, wins, losses, and guess counts while replacing only detailed payload.
update core.game_results results
set
  result_payload = jsonb_build_object(
    'version', 2,
    'migrated', true,
    'attempts', '[]'::jsonb,
    'answer', jsonb_build_object('equation', puzzles.equation),
    'stats', coalesce(
      results.result_payload -> 'stats',
      jsonb_build_object(
        'guessesUsed', results.guesses_used,
        'maxGuesses', results.max_guesses,
        'submittedGuesses', results.guesses_used,
        'wrongGuesses', case when results.is_win then greatest(0, results.guesses_used - 1) else results.guesses_used end
      )
    )
  ),
  updated_at = now()
from equadle.puzzles puzzles
where results.game_slug = 'equadle'
  and results.puzzle_id = puzzles.id::text;
