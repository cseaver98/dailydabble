-- Allow Agegaple to classify current and former relationships.
do $$
declare
  existing_constraint text;
begin
  select con.conname
    into existing_constraint
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'agegaple'
    and rel.relname = 'couples'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%relationship_type%'
  limit 1;

  if existing_constraint is not null then
    execute format('alter table agegaple.couples drop constraint %I', existing_constraint);
  end if;
end $$;

alter table agegaple.couples
  add constraint couples_relationship_type_check
  check (relationship_type in ('spouse', 'partner', 'former_spouse', 'former_partner'));
