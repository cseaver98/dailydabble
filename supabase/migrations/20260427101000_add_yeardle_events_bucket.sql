insert into storage.buckets (id, name, public)
values ('yeardle-events', 'yeardle-events', true)
on conflict (id) do update
set public = excluded.public;
