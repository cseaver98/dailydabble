-- Refill Equadle with valid 8-char equations based on pre-migration volume,
-- restore missing schedule dates, then remove backup tables.

do $$
declare
  backup_puzzle_count integer := 0;
  current_puzzle_count integer := 0;
  needed integer := 0;
begin
  if to_regclass('equadle.puzzles_pre_8char_backup') is not null then
    execute 'select count(*) from equadle.puzzles_pre_8char_backup' into backup_puzzle_count;
  end if;

  select count(*) into current_puzzle_count from equadle.puzzles;
  needed := greatest(0, backup_puzzle_count - current_puzzle_count);

  if needed > 0 then
    with candidates as (
      select format('%s*%s=%s', a, b, a * b) as equation
      from generate_series(12, 99) as a
      cross join generate_series(2, 9) as b
      where (a * b) between 100 and 999
    ),
    pool as (
      select distinct c.equation
      from candidates c
      left join equadle.puzzles p on p.equation = c.equation
      where p.id is null
      order by c.equation
      limit needed
    )
    insert into equadle.puzzles (equation, equation_length, status, reviewed_at)
    select equation, 8, 'approved', now()
    from pool;
  end if;

  -- Restore missing schedule dates from backup if available.
  if to_regclass('equadle.daily_schedule_pre_8char_backup') is not null then
    with missing_dates as (
      select b.puzzle_date,
             row_number() over (order by b.puzzle_date asc) as rn
      from equadle.daily_schedule_pre_8char_backup b
      left join equadle.daily_schedule s on s.puzzle_date = b.puzzle_date
      where s.puzzle_date is null
    ),
    available_puzzles as (
      select p.id,
             row_number() over (order by p.reviewed_at asc nulls last, p.created_at asc, p.id asc) as rn
      from equadle.puzzles p
      left join equadle.daily_schedule s on s.puzzle_id = p.id
      where s.puzzle_id is null
    )
    insert into equadle.daily_schedule (puzzle_date, puzzle_id)
    select m.puzzle_date, a.id
    from missing_dates m
    join available_puzzles a on a.rn = m.rn
    on conflict (puzzle_date) do nothing;
  end if;
end $$;

drop table if exists equadle.daily_schedule_pre_8char_backup;
drop table if exists equadle.puzzles_pre_8char_backup;
