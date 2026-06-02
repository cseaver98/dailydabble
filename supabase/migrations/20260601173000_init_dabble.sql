create schema if not exists dabble;
create extension if not exists pgcrypto;

create table if not exists dabble.phrases (
  id uuid primary key default gen_random_uuid(),
  phrase_text text not null,
  normalized_phrase text not null unique,
  source_note text,
  status text not null default 'pending_review' check (status in ('pending_review', 'approved')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists dabble.daily_schedule (
  puzzle_date date primary key,
  phrase_id uuid not null references dabble.phrases(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists dabble_phrases_created_at_idx on dabble.phrases (created_at desc);
create index if not exists dabble_phrases_status_idx on dabble.phrases (status);
create index if not exists dabble_daily_schedule_phrase_id_idx on dabble.daily_schedule (phrase_id);

alter table dabble.phrases enable row level security;
alter table dabble.daily_schedule enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'dabble' and tablename = 'phrases' and policyname = 'allow public read dabble phrases'
  ) then
    create policy "allow public read dabble phrases"
      on dabble.phrases
      for select
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'dabble' and tablename = 'daily_schedule' and policyname = 'allow public read dabble schedule'
  ) then
    create policy "allow public read dabble schedule"
      on dabble.daily_schedule
      for select
      to anon, authenticated
      using (true);
  end if;
end
$$;

grant usage on schema dabble to anon, authenticated, service_role;
grant select on dabble.phrases to anon, authenticated;
grant select on dabble.daily_schedule to anon, authenticated;
grant all privileges on all tables in schema dabble to service_role;
grant all privileges on all sequences in schema dabble to service_role;

insert into dabble.phrases (phrase_text, normalized_phrase, source_note, status, reviewed_at)
values (
  'Actions speak louder than words.',
  'actions speak louder than words',
  'seed proverb',
  'approved',
  now()
)
on conflict (normalized_phrase) do update
set phrase_text = excluded.phrase_text,
    source_note = excluded.source_note,
    status = excluded.status,
    reviewed_at = excluded.reviewed_at,
    updated_at = now();

insert into dabble.daily_schedule (puzzle_date, phrase_id)
select current_date, p.id
from dabble.phrases p
where p.normalized_phrase = 'actions speak louder than words'
on conflict (puzzle_date) do nothing;
