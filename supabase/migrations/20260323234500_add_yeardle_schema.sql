create schema if not exists yeardle;

create table if not exists yeardle.events (
  id uuid primary key default gen_random_uuid(),
  source_key text unique,
  title text not null,
  event_year integer not null,
  image_url text not null,
  image_alt text,
  wikipedia_url text,
  hint_category text,
  hint_region text,
  hint_era text,
  hint_person text,
  hint_description text,
  created_at timestamptz not null default now()
);

create table if not exists yeardle.daily_schedule (
  puzzle_date date primary key,
  event_id uuid not null references yeardle.events(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists yeardle_events_created_at_idx on yeardle.events (created_at desc);
create index if not exists yeardle_daily_schedule_event_id_idx on yeardle.daily_schedule (event_id);

alter table yeardle.events enable row level security;
alter table yeardle.daily_schedule enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'yeardle' and tablename = 'events' and policyname = 'allow public read events'
  ) then
    create policy "allow public read events"
      on yeardle.events
      for select
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'yeardle' and tablename = 'daily_schedule' and policyname = 'allow public read schedule'
  ) then
    create policy "allow public read schedule"
      on yeardle.daily_schedule
      for select
      to anon, authenticated
      using (true);
  end if;
end
$$;

grant usage on schema yeardle to anon, authenticated, service_role;
grant select on yeardle.events to anon, authenticated;
grant select on yeardle.daily_schedule to anon, authenticated;
grant all privileges on all tables in schema yeardle to service_role;
grant all privileges on all sequences in schema yeardle to service_role;

insert into yeardle.events (
  source_key,
  title,
  event_year,
  image_url,
  image_alt,
  wikipedia_url,
  hint_category,
  hint_region,
  hint_era,
  hint_person,
  hint_description
)
values (
  'apollo-11-moon-landing-1969',
  'Apollo 11 Moon Landing',
  1969,
  'https://upload.wikimedia.org/wikipedia/commons/a/a1/Aldrin_Apollo_11.jpg',
  'Buzz Aldrin on the Moon during Apollo 11',
  'https://en.wikipedia.org/wiki/Apollo_11',
  'Space exploration',
  'United States',
  '20th century',
  'Neil Armstrong',
  'The first crewed mission landed humans on the Moon.'
)
on conflict (source_key) do nothing;

insert into yeardle.daily_schedule (puzzle_date, event_id)
select current_date, e.id
from yeardle.events e
where e.source_key = 'apollo-11-moon-landing-1969'
on conflict (puzzle_date) do nothing;
