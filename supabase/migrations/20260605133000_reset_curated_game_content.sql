-- Reset curated/scheduled game content while preserving reference datasets.
-- Preserved on purpose:
--   - moviedle.movie_titles
--   - verble.dictionary_words
--   - agegaple people/couples/images reference data
--   - storage buckets/files

truncate table agegaple.guesses restart identity cascade;
truncate table agegaple.daily_puzzles restart identity cascade;
truncate table agegaple.puzzle_candidates restart identity cascade;

truncate table yeardle.daily_schedule restart identity cascade;
truncate table yeardle.events restart identity cascade;

truncate table sportle.daily_schedule restart identity cascade;
truncate table sportle.athletes restart identity cascade;

truncate table moviedle.daily_schedule restart identity cascade;
truncate table moviedle.movies restart identity cascade;

truncate table equadle.daily_schedule restart identity cascade;
truncate table equadle.puzzles restart identity cascade;

truncate table doodle.daily_schedule restart identity cascade;
truncate table doodle.puzzles restart identity cascade;

truncate table verble.daily_schedule restart identity cascade;
truncate table verble.phrases restart identity cascade;
