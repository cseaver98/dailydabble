-- Allow manual editorial overrides per Agegaple candidate.
alter table agegaple.puzzle_candidates
  add column if not exists editorial_relationship_note text,
  add column if not exists editorial_person_a_bio text,
  add column if not exists editorial_person_a_bio_url text,
  add column if not exists editorial_person_b_bio text,
  add column if not exists editorial_person_b_bio_url text,
  add column if not exists editorial_couple_context text,
  add column if not exists editorial_couple_context_url text;
