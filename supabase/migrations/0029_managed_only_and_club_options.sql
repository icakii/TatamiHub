-- 2026-10-21: the deal with every club, on every plan: we (the founders)
-- enter all student details from the Hub (photo, phone, email, parents,
-- belts, groups, schedule). Club staff only record paid fees and mark
-- attendance. On top of that, three optional extras a club can have
-- switched on from the Hub: star grades from the coach, QR check-in in the
-- hall, and store reservations that show up in the coach's panel.

-- 1) No more self-service ---------------------------------------------------
-- The column stays (deployed sites still select it) but is always false and
-- nothing grants anything on it any more.
update clubs set self_service = false;

drop policy if exists members_staff_insert on members;
drop policy if exists members_staff_update on members;
drop policy if exists classes_staff_write on classes;
drop policy if exists groups_staff_write on groups;
drop trigger if exists members_club_plan_limit on members;
drop function if exists members_club_plan_limit();

-- Contact details and photos: Hub only (platform admins update members
-- directly through members_write).
drop function if exists update_member_contact(uuid, text, text, text, text, text, text);
drop function if exists set_member_photo(uuid, text);

drop policy if exists member_photos_staff_write on storage.objects;
create policy member_photos_admin_write on storage.objects for insert to authenticated
with check (bucket_id = 'member-photos' and is_platform_admin());

drop policy if exists member_photos_staff_delete on storage.objects;
create policy member_photos_admin_delete on storage.objects for delete to authenticated
using (bucket_id = 'member-photos' and is_platform_admin());

-- Owners could update their own clubs row, which let them flip status back
-- to 'live' after a suspension or switch on paid extras. Hub only now.
drop policy if exists clubs_update on clubs;
create policy clubs_update on clubs for update
using (is_platform_admin())
with check (is_platform_admin());

-- 2) Optional extras, switched on per club from the Hub --------------------
alter table clubs add column if not exists grades_enabled boolean not null default false;
alter table clubs add column if not exists qr_checkin_enabled boolean not null default false;
alter table clubs add column if not exists store_enabled boolean not null default false;

-- Body measurements for kit sizes (kimono, belt). Entered from the Hub, and
-- copied onto each store reservation.
alter table members add column if not exists height_cm int check (height_cm between 50 and 230);
alter table members add column if not exists weight_kg int check (weight_kg between 10 and 200);

create or replace function club_option(p_club_id uuid, p_option text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case p_option
      when 'grades' then grades_enabled
      when 'qr_checkin' then qr_checkin_enabled
      when 'store' then store_enabled
    end
    from clubs where id = p_club_id
  ), false);
$$;

-- The caller's own members row in a club, if any.
create or replace function my_member_id(p_club_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from members where club_id = p_club_id and user_id = auth.uid() limit 1;
$$;

-- 3) Star grades (1-5) from the coach ---------------------------------------
create table if not exists member_grades (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs (id) on delete cascade,
  member_id uuid not null references members (id) on delete cascade,
  stars int not null check (stars between 1 and 5),
  note text check (char_length(note) <= 300),
  given_on date not null default current_date,
  given_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists member_grades_member_idx on member_grades (member_id, given_on desc);
create index if not exists member_grades_club_idx on member_grades (club_id);

alter table member_grades enable row level security;

drop policy if exists member_grades_select on member_grades;
create policy member_grades_select on member_grades for select
using (
  is_platform_admin()
  or is_club_staff(club_id)
  or exists (select 1 from members where members.id = member_grades.member_id and members.user_id = auth.uid())
);

drop policy if exists member_grades_insert on member_grades;
create policy member_grades_insert on member_grades for insert
with check (
  is_platform_admin()
  or (
    is_club_staff(club_id)
    and club_option(club_id, 'grades')
    and given_by = auth.uid()
    and exists (select 1 from members where members.id = member_grades.member_id and members.club_id = member_grades.club_id)
  )
);

drop policy if exists member_grades_delete on member_grades;
create policy member_grades_delete on member_grades for delete
using (is_platform_admin() or is_club_staff(club_id));

-- 4) QR check-in --------------------------------------------------------------
-- One secret code per club, printed as a QR on the hall wall. Kept out of
-- `clubs` because live clubs are publicly readable.
create table if not exists club_checkin_codes (
  club_id uuid primary key references clubs (id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now()
);

alter table club_checkin_codes enable row level security;
-- No policies: only reachable through the functions below.

create or replace function new_checkin_token()
returns text
language sql
volatile
as $$
  select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
$$;

-- Staff read (and lazily create) the code to print it.
create or replace function club_checkin_token(p_club_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  if not (is_platform_admin() or is_club_staff(p_club_id)) then
    raise exception 'Not allowed';
  end if;
  if not club_option(p_club_id, 'qr_checkin') then
    raise exception 'QR check-in is not enabled for this club';
  end if;
  insert into club_checkin_codes (club_id, token) values (p_club_id, new_checkin_token())
  on conflict (club_id) do nothing;
  select token into v_token from club_checkin_codes where club_id = p_club_id;
  return v_token;
end;
$$;

-- A new code makes every printed copy (and any shared photo of it) stop working.
create or replace function rotate_checkin_token(p_club_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text := new_checkin_token();
begin
  if not (is_platform_admin() or is_club_staff(p_club_id)) then
    raise exception 'Not allowed';
  end if;
  insert into club_checkin_codes (club_id, token) values (p_club_id, v_token)
  on conflict (club_id) do update set token = excluded.token, created_at = now();
  return v_token;
end;
$$;

-- A logged-in student scans the hall code: mark them present for the class
-- that is on right now (from 45 min before the start to the end), in Sofia
-- time. Returns { status: 'ok' | 'already', title, start_time }.
create or replace function qr_check_in(p_token text)
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

  select * into v_member from members where club_id = v_club and user_id = auth.uid() limit 1;
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
    'start_time', to_char(v_class.start_time, 'HH24:MI')
  );
end;
$$;

revoke all on function club_checkin_token(uuid) from public, anon;
revoke all on function rotate_checkin_token(uuid) from public, anon;
revoke all on function qr_check_in(text) from public, anon;
grant execute on function club_checkin_token(uuid) to authenticated;
grant execute on function rotate_checkin_token(uuid) to authenticated;
grant execute on function qr_check_in(text) to authenticated;

-- 5) Store reservations -------------------------------------------------------
-- A logged-in student (or parent on the child's login) reserves an item on
-- the club's store page; the coach sees it with the child's details and
-- hands it over at the hall. No online payment for merchandise.
create table if not exists store_reservations (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs (id) on delete cascade,
  member_id uuid not null references members (id) on delete cascade,
  item_key text not null check (char_length(item_key) <= 40),
  item_name text not null check (char_length(item_name) <= 80),
  size text check (char_length(size) <= 20),
  price_cents int not null check (price_cents between 0 and 1000000),
  height_cm int check (height_cm between 50 and 230),
  weight_kg int check (weight_kg between 10 and 200),
  note text check (char_length(note) <= 300),
  status text not null default 'new' check (status in ('new', 'ready', 'done', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists store_reservations_club_idx on store_reservations (club_id, created_at desc);
create index if not exists store_reservations_member_idx on store_reservations (member_id);

alter table store_reservations enable row level security;

drop policy if exists store_reservations_select on store_reservations;
create policy store_reservations_select on store_reservations for select
using (
  is_platform_admin()
  or is_club_staff(club_id)
  or member_id = my_member_id(club_id)
);

drop policy if exists store_reservations_insert on store_reservations;
create policy store_reservations_insert on store_reservations for insert
with check (
  status = 'new'
  and club_option(club_id, 'store')
  and member_id = my_member_id(club_id)
);

drop policy if exists store_reservations_staff_update on store_reservations;
create policy store_reservations_staff_update on store_reservations for update
using (is_platform_admin() or is_club_staff(club_id))
with check (is_platform_admin() or is_club_staff(club_id));

-- The student can take back a reservation the coach hasn't prepared yet.
drop policy if exists store_reservations_delete on store_reservations;
create policy store_reservations_delete on store_reservations for delete
using (
  is_platform_admin()
  or (status = 'new' and member_id = my_member_id(club_id))
);

-- Kime is the showcase: everything on.
update clubs set grades_enabled = true, qr_checkin_enabled = true, store_enabled = true
where id = 'c1000000-0000-4000-8000-000000000001';
