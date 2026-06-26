alter table core.profiles
  add column if not exists marketing_email_opt_in boolean not null default false,
  add column if not exists daily_reminder_opt_in boolean not null default false,
  add column if not exists daily_reminder_opted_in_at timestamptz null,
  add column if not exists daily_reminder_prompted_at timestamptz null,
  add column if not exists daily_reminder_last_sent_for date null;
