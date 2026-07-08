alter table if exists yeardle.events
  add column if not exists image_source_page_url text,
  add column if not exists image_file_title text,
  add column if not exists image_license text,
  add column if not exists image_license_url text,
  add column if not exists image_author text,
  add column if not exists image_attribution_text text,
  add column if not exists image_license_verified_at timestamptz;

comment on column yeardle.events.image_source_page_url is 'Original source page for the event image, preferably Wikimedia Commons.';
comment on column yeardle.events.image_attribution_text is 'Display-ready image credit/attribution text.';
comment on column yeardle.events.image_license_verified_at is 'Set when an admin verifies image licensing before approval.';
