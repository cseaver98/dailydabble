-- Moviedle candidate moderation workflow.

alter table moviedle.movies
  add column if not exists imdb_id text,
  add column if not exists imdb_votes int,
  add column if not exists status text not null default 'pending_review',
  add column if not exists source text,
  add column if not exists review_notes text,
  add column if not exists reviewed_at timestamptz;

create unique index if not exists moviedle_movies_imdb_id_key
  on moviedle.movies (imdb_id)
  where imdb_id is not null;

create index if not exists moviedle_movies_status_idx
  on moviedle.movies (status);

alter table moviedle.movies
  alter column still_urls set default '{}';

do $$
declare
  existing_stills_check text;
  existing_status_check text;
begin
  select con.conname
    into existing_stills_check
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'moviedle'
    and rel.relname = 'movies'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%still_urls%'
  limit 1;

  if existing_stills_check is not null then
    execute format('alter table moviedle.movies drop constraint %I', existing_stills_check);
  end if;

  select con.conname
    into existing_status_check
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'moviedle'
    and rel.relname = 'movies'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%status%'
  limit 1;

  if existing_status_check is not null then
    execute format('alter table moviedle.movies drop constraint %I', existing_status_check);
  end if;
end $$;

alter table moviedle.movies
  add constraint movies_still_urls_count
  check (cardinality(still_urls) <= 6);

alter table moviedle.movies
  add constraint movies_status_check
  check (status in ('pending_review', 'approved'));

update moviedle.movies
set status = 'approved'
where status is null;
