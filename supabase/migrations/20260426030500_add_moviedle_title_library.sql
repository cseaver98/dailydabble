-- Lightweight title library for Moviedle autocomplete and candidate creation.

create table if not exists moviedle.movie_titles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  title_normalized text not null unique,
  imdb_id text,
  source text not null default 'seed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint movie_titles_title_nonempty check (length(btrim(title)) > 0)
);

create unique index if not exists moviedle_movie_titles_imdb_id_key
  on moviedle.movie_titles (imdb_id)
  where imdb_id is not null;

create index if not exists moviedle_movie_titles_title_normalized_prefix_idx
  on moviedle.movie_titles (title_normalized text_pattern_ops);

create index if not exists moviedle_movie_titles_title_idx
  on moviedle.movie_titles (title);

create or replace function moviedle.touch_movie_titles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_movie_titles_touch_updated_at on moviedle.movie_titles;
create trigger trg_movie_titles_touch_updated_at
before update on moviedle.movie_titles
for each row
execute function moviedle.touch_movie_titles_updated_at();

alter table moviedle.movie_titles enable row level security;
