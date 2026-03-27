-- Agegaple hardening:
-- - enable RLS
-- - allow safe public SELECT on gameplay-facing rows
-- - block client-side writes
-- - preserve service_role full access
--
-- Also re-assert RLS + public read policies for Equadle/Sportle if missing.

grant usage on schema agegaple to anon, authenticated, service_role;

grant all privileges on all tables in schema agegaple to service_role;
grant all privileges on all sequences in schema agegaple to service_role;

alter default privileges in schema agegaple
grant all privileges on tables to service_role;

alter default privileges in schema agegaple
grant all privileges on sequences to service_role;

do $$
begin
  if to_regclass('agegaple.daily_puzzles') is not null then
    execute 'alter table agegaple.daily_puzzles enable row level security';
    execute 'revoke all privileges on table agegaple.daily_puzzles from anon, authenticated';
    execute 'grant select on table agegaple.daily_puzzles to anon, authenticated';
    execute 'drop policy if exists "allow public read agegaple daily puzzles" on agegaple.daily_puzzles';
    execute $policy$
      create policy "allow public read agegaple daily puzzles"
        on agegaple.daily_puzzles
        for select
        to anon, authenticated
        using (puzzle_date <= current_date)
    $policy$;
  end if;

  if to_regclass('agegaple.puzzle_candidates') is not null then
    execute 'alter table agegaple.puzzle_candidates enable row level security';
    execute 'revoke all privileges on table agegaple.puzzle_candidates from anon, authenticated';
    execute 'grant select on table agegaple.puzzle_candidates to anon, authenticated';
    execute 'drop policy if exists "allow public read agegaple puzzle candidates" on agegaple.puzzle_candidates';
    execute $policy$
      create policy "allow public read agegaple puzzle candidates"
        on agegaple.puzzle_candidates
        for select
        to anon, authenticated
        using (
          status = 'approved'
          or exists (
            select 1
            from agegaple.daily_puzzles dp
            where dp.candidate_id = agegaple.puzzle_candidates.id
              and dp.puzzle_date <= current_date
          )
        )
    $policy$;
  end if;

  if to_regclass('agegaple.couples') is not null then
    execute 'alter table agegaple.couples enable row level security';
    execute 'revoke all privileges on table agegaple.couples from anon, authenticated';
    execute 'grant select on table agegaple.couples to anon, authenticated';
    execute 'drop policy if exists "allow public read agegaple couples" on agegaple.couples';
    execute $policy$
      create policy "allow public read agegaple couples"
        on agegaple.couples
        for select
        to anon, authenticated
        using (
          exists (
            select 1
            from agegaple.puzzle_candidates pc
            join agegaple.daily_puzzles dp on dp.candidate_id = pc.id
            where pc.couple_id = agegaple.couples.id
              and dp.puzzle_date <= current_date
          )
        )
    $policy$;
  end if;

  if to_regclass('agegaple.people') is not null then
    execute 'alter table agegaple.people enable row level security';
    execute 'revoke all privileges on table agegaple.people from anon, authenticated';
    execute 'grant select on table agegaple.people to anon, authenticated';
    execute 'drop policy if exists "allow public read agegaple people" on agegaple.people';
    execute $policy$
      create policy "allow public read agegaple people"
        on agegaple.people
        for select
        to anon, authenticated
        using (
          exists (
            select 1
            from agegaple.couples c
            join agegaple.puzzle_candidates pc on pc.couple_id = c.id
            join agegaple.daily_puzzles dp on dp.candidate_id = pc.id
            where (c.person_a_id = agegaple.people.id or c.person_b_id = agegaple.people.id)
              and dp.puzzle_date <= current_date
          )
        )
    $policy$;
  end if;

  if to_regclass('agegaple.images') is not null then
    execute 'alter table agegaple.images enable row level security';
    execute 'revoke all privileges on table agegaple.images from anon, authenticated';
    execute 'grant select on table agegaple.images to anon, authenticated';
    execute 'drop policy if exists "allow public read agegaple images" on agegaple.images';
    execute $policy$
      create policy "allow public read agegaple images"
        on agegaple.images
        for select
        to anon, authenticated
        using (
          coalesce(is_usable, true) = true
          and (
            exists (
              select 1
              from agegaple.puzzle_candidates pc
              join agegaple.daily_puzzles dp on dp.candidate_id = pc.id
              where pc.image_id = agegaple.images.id
                and dp.puzzle_date <= current_date
            )
            or (
              agegaple.images.subject_type = 'couple'
              and exists (
                select 1
                from agegaple.puzzle_candidates pc
                join agegaple.daily_puzzles dp on dp.candidate_id = pc.id
                where pc.couple_id = agegaple.images.subject_id
                  and dp.puzzle_date <= current_date
              )
            )
          )
        )
    $policy$;
  end if;

  -- Guesses should not be client-readable/writable directly.
  if to_regclass('agegaple.guesses') is not null then
    execute 'alter table agegaple.guesses enable row level security';
    execute 'revoke all privileges on table agegaple.guesses from anon, authenticated';
    execute 'drop policy if exists "allow public read agegaple guesses" on agegaple.guesses';
  end if;
end
$$;

-- Re-assert RLS/policies for Equadle and Sportle if they drifted.
do $$
begin
  if to_regclass('equadle.puzzles') is not null then
    execute 'alter table equadle.puzzles enable row level security';
    if not exists (
      select 1 from pg_policies
      where schemaname = 'equadle'
        and tablename = 'puzzles'
        and policyname = 'allow public read equadle puzzles'
    ) then
      execute $policy$
        create policy "allow public read equadle puzzles"
          on equadle.puzzles
          for select
          to anon, authenticated
          using (true)
      $policy$;
    end if;
  end if;

  if to_regclass('equadle.daily_schedule') is not null then
    execute 'alter table equadle.daily_schedule enable row level security';
    if not exists (
      select 1 from pg_policies
      where schemaname = 'equadle'
        and tablename = 'daily_schedule'
        and policyname = 'allow public read equadle schedule'
    ) then
      execute $policy$
        create policy "allow public read equadle schedule"
          on equadle.daily_schedule
          for select
          to anon, authenticated
          using (true)
      $policy$;
    end if;
  end if;

  if to_regclass('sportle.athletes') is not null then
    execute 'alter table sportle.athletes enable row level security';
    if not exists (
      select 1 from pg_policies
      where schemaname = 'sportle'
        and tablename = 'athletes'
        and policyname = 'allow public read sportle athletes'
    ) then
      execute $policy$
        create policy "allow public read sportle athletes"
          on sportle.athletes
          for select
          to anon, authenticated
          using (true)
      $policy$;
    end if;
  end if;

  if to_regclass('sportle.daily_schedule') is not null then
    execute 'alter table sportle.daily_schedule enable row level security';
    if not exists (
      select 1 from pg_policies
      where schemaname = 'sportle'
        and tablename = 'daily_schedule'
        and policyname = 'allow public read sportle schedule'
    ) then
      execute $policy$
        create policy "allow public read sportle schedule"
          on sportle.daily_schedule
          for select
          to anon, authenticated
          using (true)
      $policy$;
    end if;
  end if;
end
$$;
