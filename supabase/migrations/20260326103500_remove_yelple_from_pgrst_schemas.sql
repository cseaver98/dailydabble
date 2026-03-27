-- Remove the retired yelple schema from PostgREST exposed schemas.
alter role authenticator
  set pgrst.db_schemas = 'public,graphql_public,hub,core,agegaple,doodle,yeardle,moviedle,equadle,sportle';

-- Keep the standard extra search path.
alter role authenticator
  set pgrst.db_extra_search_path = 'public,extensions';

-- Ask PostgREST to reload role settings immediately.
notify pgrst, 'reload config';
