do $$
begin
  alter role authenticator set pgrst.db_schemas = 'public,storage,graphql_public,agegaple,doodle,equadle,moviedle,sportle,yeardle,dabble';
exception
  when others then
    raise notice 'Could not set pgrst.db_schemas on authenticator: %', sqlerrm;
end
$$;

notify pgrst, 'reload config';
notify pgrst, 'reload schema';
