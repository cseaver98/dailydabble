-- Wipe Agegaple reference/content data for a full reset.
truncate table agegaple.images restart identity cascade;
truncate table agegaple.couples restart identity cascade;
truncate table agegaple.people restart identity cascade;
