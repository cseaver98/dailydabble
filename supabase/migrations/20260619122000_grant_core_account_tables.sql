-- Ensure server-side service-role routes can read/write the shared core tables
-- through PostgREST after exposing the core schema.
grant usage on schema core to anon, authenticated, service_role;

grant all privileges on table core.players to service_role;
grant all privileges on table core.completions to service_role;
grant all privileges on table core.profiles to service_role;
grant all privileges on table core.game_results to service_role;

grant all privileges on all sequences in schema core to service_role;

notify pgrst, 'reload schema';
