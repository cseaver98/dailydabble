alter table yeardle.events
  drop column if exists hint_person;

notify pgrst, 'reload schema';
