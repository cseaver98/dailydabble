grant usage on schema moviedle to service_role, authenticated, anon;

grant all privileges on all tables in schema moviedle to service_role;
grant all privileges on all sequences in schema moviedle to service_role;

grant select on table moviedle.movies to authenticated, anon;
grant select on table moviedle.daily_schedule to authenticated, anon;

alter default privileges in schema moviedle
grant all privileges on tables to service_role;

alter default privileges in schema moviedle
grant all privileges on sequences to service_role;
