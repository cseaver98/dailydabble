grant usage on schema doodle to service_role, authenticated, anon;

grant all privileges on all tables in schema doodle to service_role;
grant all privileges on all sequences in schema doodle to service_role;

grant select on table doodle.puzzles to authenticated, anon;
grant select on table doodle.daily_schedule to authenticated, anon;

alter default privileges in schema doodle
grant all privileges on tables to service_role;

alter default privileges in schema doodle
grant all privileges on sequences to service_role;
