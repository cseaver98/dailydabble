-- Rename Moviedle status value from pending_review -> pending.

do $$
declare
  existing_status_check text;
begin
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

update moviedle.movies
set status = 'pending'
where status = 'pending_review';

alter table moviedle.movies
  alter column status set default 'pending';

alter table moviedle.movies
  add constraint movies_status_check
  check (status in ('pending', 'approved'));
