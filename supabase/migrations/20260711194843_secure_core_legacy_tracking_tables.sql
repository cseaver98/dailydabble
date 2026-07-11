-- Legacy player and completion tracking is handled exclusively by server routes
-- using the service role. Client roles should not access these tables directly.
alter table core.players enable row level security;
alter table core.completions enable row level security;

revoke all privileges on table core.players from anon, authenticated;
revoke all privileges on table core.completions from anon, authenticated;

grant usage on schema core to service_role;
grant all privileges on table core.players to service_role;
grant all privileges on table core.completions to service_role;
grant all privileges on all sequences in schema core to service_role;

notify pgrst, 'reload schema';
