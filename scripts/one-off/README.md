# One-off prod maintenance scripts

These scripts were created for the July 2026 archive/subscription launch cleanup.
They are not normal seed commands.

- `seed-agegaple-owner-secret-game.mjs` uploads owner-provided Agegaple photos and schedules the secret Agegaple archive game.
- `schedule-agegaple-secret-game.mjs` validates/schedules an existing Agegaple candidate onto the secret archive date.
- `cleanup-archive-launch-data.mjs` trims prod playable game data to the first secret archive game while preserving reference tables such as `moviedle.movie_titles` and `verble.dictionary_words`.

Use dry-run mode first. Destructive scripts require explicit `--apply` / confirmation flags.
