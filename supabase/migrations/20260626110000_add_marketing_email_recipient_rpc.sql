create or replace function core.get_marketing_email_recipients()
returns table (
  user_id uuid,
  email text
)
language sql
security definer
set search_path = core, auth, public
as $$
  select
    profiles.id as user_id,
    users.email::text as email
  from core.profiles
  join auth.users
    on users.id = profiles.id
  where profiles.marketing_email_opt_in = true
    and users.email is not null
    and users.email <> '';
$$;

revoke all on function core.get_marketing_email_recipients() from public;
revoke all on function core.get_marketing_email_recipients() from anon;
revoke all on function core.get_marketing_email_recipients() from authenticated;
grant execute on function core.get_marketing_email_recipients() to service_role;
