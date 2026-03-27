-- Add optional rich movie metadata for Moviedle result cards and autocomplete workflows.
alter table moviedle.movies
  add column if not exists release_year int,
  add column if not exists summary text,
  add column if not exists lead_actors text[] not null default '{}';

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'moviedle'
      and t.relname = 'movies'
      and c.conname = 'movies_release_year_range'
  ) then
    alter table moviedle.movies
      add constraint movies_release_year_range
      check (release_year is null or (release_year >= 1888 and release_year <= 2100));
  end if;
end $$;
