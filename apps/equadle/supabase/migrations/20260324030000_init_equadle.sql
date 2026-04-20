create schema if not exists equadle;

create table if not exists equadle.puzzles (
  id uuid primary key default gen_random_uuid(),
  equation text not null unique,
  equation_length integer not null default 9,
  status text not null default 'pending_review' check (status in ('pending_review', 'approved')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint equadle_puzzles_equation_len_chk check (char_length(equation) = equation_length)
);

create table if not exists equadle.daily_schedule (
  puzzle_date date primary key,
  puzzle_id uuid not null references equadle.puzzles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists equadle_puzzles_created_at_idx on equadle.puzzles (created_at desc);
create index if not exists equadle_puzzles_status_idx on equadle.puzzles (status);
create index if not exists equadle_daily_schedule_puzzle_id_idx on equadle.daily_schedule (puzzle_id);

alter table equadle.puzzles enable row level security;
alter table equadle.daily_schedule enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'equadle' and tablename = 'puzzles' and policyname = 'allow public read equadle puzzles'
  ) then
    create policy "allow public read equadle puzzles"
      on equadle.puzzles
      for select
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'equadle' and tablename = 'daily_schedule' and policyname = 'allow public read equadle schedule'
  ) then
    create policy "allow public read equadle schedule"
      on equadle.daily_schedule
      for select
      to anon, authenticated
      using (true);
  end if;
end
$$;

grant usage on schema equadle to anon, authenticated, service_role;
grant select on equadle.puzzles to anon, authenticated;
grant select on equadle.daily_schedule to anon, authenticated;
grant all privileges on all tables in schema equadle to service_role;
grant all privileges on all sequences in schema equadle to service_role;

insert into equadle.puzzles (equation, equation_length)
values ('3*10-4=26', 9)
on conflict (equation) do nothing;

insert into equadle.daily_schedule (puzzle_date, puzzle_id)
select current_date, p.id
from equadle.puzzles p
where p.equation = '3*10-4=26'
on conflict (puzzle_date) do nothing;
