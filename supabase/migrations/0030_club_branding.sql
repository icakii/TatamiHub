-- 2026-11-13: one app for every club at app.tatamistudio.net/<slug>. The
-- app paints itself per club: name, logo and accent colour come from here,
-- and the home-screen icons live in a public bucket under <club_id>/.
alter table clubs add column if not exists logo_path text check (char_length(logo_path) <= 200);
alter table clubs add column if not exists accent_color text not null default '#c2361f'
  check (accent_color ~ '^#[0-9a-fA-F]{6}$');

-- Logos and app icons are meant to be public (they end up on phones and in
-- link previews), so the bucket is public-read; only we upload.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('club-assets', 'club-assets', true, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists club_assets_admin_insert on storage.objects;
create policy club_assets_admin_insert on storage.objects for insert to authenticated
with check (bucket_id = 'club-assets' and is_platform_admin());

drop policy if exists club_assets_admin_update on storage.objects;
create policy club_assets_admin_update on storage.objects for update to authenticated
using (bucket_id = 'club-assets' and is_platform_admin())
with check (bucket_id = 'club-assets' and is_platform_admin());

drop policy if exists club_assets_admin_delete on storage.objects;
create policy club_assets_admin_delete on storage.objects for delete to authenticated
using (bucket_id = 'club-assets' and is_platform_admin());
