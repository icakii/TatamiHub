-- Security pass 2026-11-20, part 2.

-- 1) Links saved in the Hub must be real web links (no javascript:, data:).
create or replace function only_http_links(p jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(bool_and((l ->> 'url') ~* '^https?://'), true) from jsonb_array_elements(p) l;
$$;

alter table team_notes drop constraint if exists team_notes_links_http;
alter table team_notes add constraint team_notes_links_http check (only_http_links(links)) not valid;
alter table team_notes validate constraint team_notes_links_http;

alter table recurring_costs drop constraint if exists recurring_costs_url_http;
alter table recurring_costs add constraint recurring_costs_url_http check (url is null or url ~* '^https?://');

-- 2) Files: only safe types. No HTML or SVG anywhere (both can carry
--    scripts); club logos are raster images.
update storage.buckets set allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
where id = 'club-assets';

update storage.buckets set allowed_mime_types = array[
  'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
  'application/pdf', 'text/plain', 'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip', 'video/mp4', 'video/quicktime'
]
where id = 'team-files';
