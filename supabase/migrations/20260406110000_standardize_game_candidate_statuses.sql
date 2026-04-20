alter table if exists equadle.puzzles
  add column if not exists status text not null default 'pending_review',
  add column if not exists reviewed_at timestamptz;

alter table if exists sportle.athletes
  add column if not exists status text not null default 'pending_review',
  add column if not exists reviewed_at timestamptz;

alter table if exists yeardle.events
  add column if not exists status text not null default 'pending_review',
  add column if not exists reviewed_at timestamptz;

do $$
declare
  equadle_status_check text;
  sportle_status_check text;
  yeardle_status_check text;
begin
  select con.conname into equadle_status_check
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'equadle'
    and rel.relname = 'puzzles'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%status%';

  if equadle_status_check is not null then
    execute format('alter table equadle.puzzles drop constraint %I', equadle_status_check);
  end if;

  select con.conname into sportle_status_check
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'sportle'
    and rel.relname = 'athletes'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%status%';

  if sportle_status_check is not null then
    execute format('alter table sportle.athletes drop constraint %I', sportle_status_check);
  end if;

  select con.conname into yeardle_status_check
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'yeardle'
    and rel.relname = 'events'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%status%';

  if yeardle_status_check is not null then
    execute format('alter table yeardle.events drop constraint %I', yeardle_status_check);
  end if;
end $$;

alter table if exists equadle.puzzles
  add constraint equadle_puzzles_status_check
  check (status in ('pending_review', 'approved'));

alter table if exists sportle.athletes
  add constraint sportle_athletes_status_check
  check (status in ('pending_review', 'approved'));

alter table if exists yeardle.events
  add constraint yeardle_events_status_check
  check (status in ('pending_review', 'approved'));

update equadle.puzzles
set status = coalesce(status, 'approved');

update sportle.athletes
set status = coalesce(status, 'approved');

update yeardle.events
set status = coalesce(status, 'approved');

create index if not exists equadle_puzzles_status_idx on equadle.puzzles(status);
create index if not exists sportle_athletes_status_idx on sportle.athletes(status);
create index if not exists yeardle_events_status_idx on yeardle.events(status);
