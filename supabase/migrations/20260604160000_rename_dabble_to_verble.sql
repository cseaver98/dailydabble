do $$
begin
  if exists (
    select 1
    from pg_namespace
    where nspname = 'dabble'
  ) and not exists (
    select 1
    from pg_namespace
    where nspname = 'verble'
  ) then
    execute 'alter schema dabble rename to verble';
  end if;
end $$;

grant usage on schema verble to anon, authenticated, service_role;
grant select on all tables in schema verble to anon, authenticated;
grant all privileges on all tables in schema verble to service_role;
grant all privileges on all sequences in schema verble to service_role;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'verble'
      and table_name = 'phrases'
      and column_name = 'reveal_plan'
  ) then
    execute 'grant select (reveal_plan) on verble.phrases to anon, authenticated';
  end if;
end $$;

alter role authenticator set pgrst.db_schemas = 'public,storage,graphql_public,agegaple,doodle,equadle,moviedle,sportle,yeardle,verble';

notify pgrst, 'reload config';
notify pgrst, 'reload schema';
