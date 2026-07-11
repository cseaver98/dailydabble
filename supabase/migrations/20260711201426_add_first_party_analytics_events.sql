create table if not exists core.analytics_events (
  id bigint generated always as identity primary key,
  event_id uuid not null unique,
  event_name text not null check (
    event_name in (
      'homepage_viewed',
      'game_opened',
      'game_started',
      'game_completed',
      'next_game_clicked',
      'result_shared',
      'account_wall_shown',
      'signup_started',
      'signup_completed',
      'reminder_prompt_shown',
      'reminder_enabled'
    )
  ),
  player_id uuid references core.players(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  session_id uuid not null,
  game_slug text check (
    game_slug is null or game_slug in ('verble', 'agegaple', 'doodle', 'equadle', 'yeardle', 'moviedle', 'sportle')
  ),
  puzzle_date date,
  is_archive boolean not null default false,
  page_path text not null,
  referrer_domain text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  device_type text not null check (device_type in ('mobile', 'tablet', 'desktop', 'unknown')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_created_at_idx
  on core.analytics_events (created_at desc);

create index if not exists analytics_events_name_created_at_idx
  on core.analytics_events (event_name, created_at desc);

create index if not exists analytics_events_player_created_at_idx
  on core.analytics_events (player_id, created_at desc)
  where player_id is not null;

create index if not exists analytics_events_user_created_at_idx
  on core.analytics_events (user_id, created_at desc)
  where user_id is not null;

create index if not exists analytics_events_session_created_at_idx
  on core.analytics_events (session_id, created_at desc);

create index if not exists analytics_events_game_created_at_idx
  on core.analytics_events (game_slug, created_at desc)
  where game_slug is not null;

alter table core.analytics_events enable row level security;

revoke all privileges on table core.analytics_events from anon, authenticated;
grant select, insert on table core.analytics_events to service_role;
grant usage, select on sequence core.analytics_events_id_seq to service_role;
