create table if not exists dabble.dictionary_words (
  word text primary key,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists dabble_dictionary_words_active_idx
  on dabble.dictionary_words (is_active);

alter table dabble.dictionary_words enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'dabble' and tablename = 'dictionary_words' and policyname = 'allow public read dabble dictionary words'
  ) then
    create policy "allow public read dabble dictionary words"
      on dabble.dictionary_words
      for select
      to anon, authenticated
      using (true);
  end if;
end
$$;

grant select on dabble.dictionary_words to anon, authenticated;
grant all privileges on dabble.dictionary_words to service_role;
