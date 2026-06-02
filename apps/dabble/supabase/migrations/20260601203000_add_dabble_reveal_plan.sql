alter table dabble.phrases
add column if not exists reveal_plan jsonb not null default '[]'::jsonb;

grant select (reveal_plan) on dabble.phrases to anon, authenticated;
