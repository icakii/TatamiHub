-- 2026-11-15, first real client (Спартак Плевен):
--  1. Coaches add students and edit their details themselves again.
--  2. ЕГН on the student record (staff-only, like the rest of the record).
--  3. A parent login can hold several children (one auth user, many members).
--  4. Coaches add competitions (the next tournament shows in the app).

-- 1) Coaches manage their own students -----------------------------------------
drop policy if exists members_staff_insert on members;
create policy members_staff_insert on members for insert
with check (is_club_staff(club_id) and role = 'student' and user_id is null);

drop policy if exists members_staff_update on members;
create policy members_staff_update on members for update
using (is_club_staff(club_id) and role = 'student')
with check (is_club_staff(club_id) and role = 'student');

-- Staff can't promote anyone, move a member to another club, or touch logins
-- (members_guard_user_id from 0027 already covers user_id).
create or replace function members_guard_structure()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.role is distinct from old.role or new.club_id is distinct from old.club_id)
     and not is_platform_admin()
     and coalesce(current_setting('request.jwt.claims', true)::json ->> 'role', '') <> 'service_role'
     and current_user not in ('postgres', 'supabase_admin', 'service_role') then
    raise exception 'Roles and clubs are managed by Tatami';
  end if;
  return new;
end;
$$;

drop trigger if exists members_guard_structure on members;
create trigger members_guard_structure
before update on members
for each row execute function members_guard_structure();

-- Contact and photo edits by staff go back to being plain updates.
drop policy if exists member_photos_staff_write on storage.objects;
create policy member_photos_staff_write on storage.objects for insert to authenticated
with check (bucket_id = 'member-photos' and is_club_staff(((storage.foldername(name))[1])::uuid));

drop policy if exists member_photos_staff_delete on storage.objects;
create policy member_photos_staff_delete on storage.objects for delete to authenticated
using (bucket_id = 'member-photos' and is_club_staff(((storage.foldername(name))[1])::uuid));

-- 2) ЕГН ----------------------------------------------------------------------------
-- Bulgarian personal number: 10 digits (the checksum is validated in the
-- forms). Readable only by staff, platform admins and the person themselves,
-- through the existing members policies.
alter table members add column if not exists egn text check (egn ~ '^[0-9]{10}$');

-- 3) Parents with several children ------------------------------------------------
-- One login, one members row per child. The login becomes "the family's".
drop index if exists members_user_id_idx;
create index if not exists members_user_id_lookup_idx on members (user_id) where user_id is not null;

-- With several rows per login, the staff role must win over a child row
-- (a coach can also have a kid training in the same club).
create or replace function member_role(p_club_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from members
  where club_id = p_club_id and user_id = auth.uid()
  order by case role when 'owner' then 0 when 'coach' then 1 else 2 end
  limit 1;
$$;

-- "Is this member mine?" instead of "my single member row".
create or replace function owns_member(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from members where id = p_member_id and user_id = auth.uid());
$$;

drop policy if exists store_reservations_select on store_reservations;
create policy store_reservations_select on store_reservations for select
using (is_platform_admin() or is_club_staff(club_id) or owns_member(member_id));

drop policy if exists store_reservations_insert on store_reservations;
create policy store_reservations_insert on store_reservations for insert
with check (
  status = 'new'
  and club_option(club_id, 'store')
  and owns_member(member_id)
  and exists (select 1 from members where members.id = member_id and members.club_id = store_reservations.club_id)
);

drop policy if exists store_reservations_delete on store_reservations;
create policy store_reservations_delete on store_reservations for delete
using (is_platform_admin() or (status = 'new' and owns_member(member_id)));

-- QR check-in for a chosen child (falls back to the only one).
drop function if exists qr_check_in(text);
create or replace function qr_check_in(p_token text, p_member_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club uuid;
  v_member members;
  v_local timestamp := now() at time zone 'Europe/Sofia';
  v_day int := extract(isodow from v_local)::int - 1;
  v_time time := v_local::time;
  v_class classes;
  v_existing text;
begin
  select club_id into v_club from club_checkin_codes where token = p_token;
  if v_club is null or not club_option(v_club, 'qr_checkin') then
    raise exception 'bad_code';
  end if;

  select * into v_member from members
  where club_id = v_club and user_id = auth.uid()
    and (p_member_id is null or id = p_member_id)
  order by case role when 'student' then 0 else 1 end
  limit 1;
  if v_member.id is null or v_member.status = 'left' then
    raise exception 'not_member';
  end if;

  select c.* into v_class
  from classes c
  where c.club_id = v_club
    and c.weekday = v_day
    and (c.group_id is null or c.group_id = v_member.group_id)
    and v_time between c.start_time - interval '45 minutes' and c.start_time + make_interval(mins => c.duration_min)
  order by abs(extract(epoch from (v_time - c.start_time)))
  limit 1;
  if v_class.id is null then
    raise exception 'no_class';
  end if;

  select status into v_existing from attendance
  where class_id = v_class.id and member_id = v_member.id and session_date = v_local::date;

  insert into attendance (club_id, class_id, member_id, session_date, status, marked_by)
  values (v_club, v_class.id, v_member.id, v_local::date, 'present', auth.uid())
  on conflict (class_id, member_id, session_date)
  do update set status = 'present', marked_by = auth.uid(), updated_at = now();

  return jsonb_build_object(
    'status', case when v_existing = 'present' then 'already' else 'ok' end,
    'title', v_class.title,
    'start_time', to_char(v_class.start_time, 'HH24:MI'),
    'member', v_member.full_name
  );
end;
$$;
revoke all on function qr_check_in(text, uuid) from public, anon;
grant execute on function qr_check_in(text, uuid) to authenticated;

-- For create-member-account: find an existing login by email, so a second
-- child can be linked to the parent's account. Service role only.
create or replace function auth_user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
$$;
revoke all on function auth_user_id_by_email(text) from public, anon, authenticated;
grant execute on function auth_user_id_by_email(text) to service_role;

-- 4) Coaches add competitions (results/entries stay with us for now) --------------
drop policy if exists competitions_write on competitions;
create policy competitions_write on competitions for all
using (is_platform_admin() or is_club_staff(club_id))
with check (is_platform_admin() or is_club_staff(club_id));
