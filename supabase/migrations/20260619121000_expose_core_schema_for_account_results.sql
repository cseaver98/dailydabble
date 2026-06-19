-- Expose the shared core schema to PostgREST so server routes can use
-- Supabase's REST client against core.players/core.completions/core.game_results.
alter role authenticator set pgrst.db_schemas = 'public,storage,graphql_public,core,agegaple,doodle,equadle,moviedle,sportle,yeardle,verble';

notify pgrst, 'reload config';
notify pgrst, 'reload schema';
