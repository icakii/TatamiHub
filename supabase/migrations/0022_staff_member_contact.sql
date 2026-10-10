-- Owners and coaches may now keep their students' contact details up to
-- date themselves: photo, email, phone and parent/guardian info. Everything
-- structural (who exists, belt, group, fee, status, logins) stays Hub-only,
-- so instead of loosening members_write this goes through two narrow
-- SECURITY DEFINER functions that touch only those columns.

alter table members add column if not exists photo_path text;

create or replace function update_member_contact(
  p_member_id uuid,
  p_email text,
  p_phone text,
  p_guardian_first_name text,
  p_guardian_last_name text,
  p_guardian_phone text,
  p_guardian_email text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club uuid;
begin
  select club_id into v_club from members where id = p_member_id;
  if v_club is null or not (is_club_staff(v_club) or is_platform_admin()) then
    raise exception 'Not allowed';
  end if;

  if char_length(coalesce(p_email, '')) > 200
    or char_length(coalesce(p_phone, '')) > 40
    or char_length(coalesce(p_guardian_first_name, '')) > 80
    or char_length(coalesce(p_guardian_last_name, '')) > 80
    or char_length(coalesce(p_guardian_phone, '')) > 40
    or char_length(coalesce(p_guardian_email, '')) > 200 then
    raise exception 'Value too long';
  end if;

  update members set
    email = nullif(trim(p_email), ''),
    phone = nullif(trim(p_phone), ''),
    guardian_first_name = nullif(trim(p_guardian_first_name), ''),
    guardian_last_name = nullif(trim(p_guardian_last_name), ''),
    guardian_phone = nullif(trim(p_guardian_phone), ''),
    guardian_email = nullif(trim(p_guardian_email), '')
  where id = p_member_id;
end;
$$;

create or replace function set_member_photo(p_member_id uuid, p_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club uuid;
begin
  select club_id into v_club from members where id = p_member_id;
  if v_club is null or not (is_club_staff(v_club) or is_platform_admin()) then
    raise exception 'Not allowed';
  end if;
  -- The file must sit in this member's own folder: <club_id>/<member_id>/...
  if p_path is not null and p_path not like v_club::text || '/' || p_member_id::text || '/%' then
    raise exception 'Bad photo path';
  end if;
  update members set photo_path = p_path where id = p_member_id;
end;
$$;

grant execute on function update_member_contact(uuid, text, text, text, text, text, text) to authenticated;
grant execute on function set_member_photo(uuid, text) to authenticated;

-- Private bucket: student photos (often minors) are never public. Read via
-- short-lived signed URLs only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('member-photos', 'member-photos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Paths are <club_id>/<member_id>/<file>.
drop policy if exists member_photos_staff_write on storage.objects;
create policy member_photos_staff_write on storage.objects for insert to authenticated
with check (
  bucket_id = 'member-photos'
  and (is_platform_admin() or is_club_staff(((storage.foldername(name))[1])::uuid))
);

drop policy if exists member_photos_staff_delete on storage.objects;
create policy member_photos_staff_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'member-photos'
  and (is_platform_admin() or is_club_staff(((storage.foldername(name))[1])::uuid))
);

drop policy if exists member_photos_read on storage.objects;
create policy member_photos_read on storage.objects for select to authenticated
using (
  bucket_id = 'member-photos'
  and (
    is_platform_admin()
    or is_club_staff(((storage.foldername(name))[1])::uuid)
    or exists (
      select 1 from members
      where members.id::text = (storage.foldername(name))[2]
        and members.user_id = auth.uid()
    )
  )
);
