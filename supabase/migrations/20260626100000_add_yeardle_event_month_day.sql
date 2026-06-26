alter table if exists yeardle.events
  add column if not exists event_month integer,
  add column if not exists event_day integer;

alter table if exists yeardle.events
  drop constraint if exists yeardle_events_event_month_check,
  add constraint yeardle_events_event_month_check
    check (event_month is null or event_month between 1 and 12);

alter table if exists yeardle.events
  drop constraint if exists yeardle_events_event_day_check,
  add constraint yeardle_events_event_day_check
    check (event_day is null or event_day between 1 and 31);

alter table if exists yeardle.events
  drop constraint if exists yeardle_events_event_month_day_pair_check,
  add constraint yeardle_events_event_month_day_pair_check
    check ((event_month is null and event_day is null) or (event_month is not null and event_day is not null));

alter table if exists yeardle.events
  drop constraint if exists yeardle_events_event_month_day_real_check,
  add constraint yeardle_events_event_month_day_real_check
    check (
      event_month is null
      or event_day <= case
        when event_month in (1, 3, 5, 7, 8, 10, 12) then 31
        when event_month in (4, 6, 9, 11) then 30
        when event_month = 2 then 29
        else 0
      end
    );

create index if not exists yeardle_events_event_month_day_idx
  on yeardle.events (event_month, event_day);
