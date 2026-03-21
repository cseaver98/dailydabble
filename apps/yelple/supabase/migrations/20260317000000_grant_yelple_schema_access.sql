-- Ensure API roles can use/read schema objects in yelple.
grant usage on schema yelple to anon, authenticated, service_role;

grant select on all tables in schema yelple to anon, authenticated, service_role;
grant insert, update, delete on all tables in schema yelple to service_role;
grant usage, select on all sequences in schema yelple to service_role;

alter default privileges in schema yelple
  grant select on tables to anon, authenticated, service_role;

alter default privileges in schema yelple
  grant insert, update, delete on tables to service_role;

alter default privileges in schema yelple
  grant usage, select on sequences to service_role;
