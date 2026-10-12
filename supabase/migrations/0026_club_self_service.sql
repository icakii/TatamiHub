-- Plan split (2026-10-13): on the "Клуб" plan the club runs its own admin
-- (adds students, changes belts, builds the schedule); on "Клуб Pro" we do
-- it for them from the Hub. self_service switches the club's own staff
-- write access on for members and classes. Logins, deletes and anything
-- outside these two tables stay Hub-only either way.
alter table clubs add column if not exists self_service boolean not null default false;

create or replace function club_self_service(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select self_service from clubs where id = p_club_id), false);
$$;

drop policy if exists members_staff_insert on members;
create policy members_staff_insert on members for insert
with check (
  is_club_staff(club_id) and club_self_service(club_id)
  and role = 'student' and user_id is null
);

drop policy if exists members_staff_update on members;
create policy members_staff_update on members for update
using (is_club_staff(club_id) and club_self_service(club_id))
with check (
  is_club_staff(club_id) and club_self_service(club_id)
  -- staff can't promote anyone or attach logins themselves
  and role = 'student'
);

drop policy if exists classes_staff_write on classes;
create policy classes_staff_write on classes for all
using (is_club_staff(club_id) and club_self_service(club_id))
with check (is_club_staff(club_id) and club_self_service(club_id));

-- Groups are read by staff; let them be created alongside classes too.
drop policy if exists groups_staff_write on groups;
create policy groups_staff_write on groups for all
using (is_club_staff(club_id) and club_self_service(club_id))
with check (is_club_staff(club_id) and club_self_service(club_id));

-- Kime is the "Клуб" example, so it shows self-service.
update clubs set self_service = true where id = 'c1000000-0000-4000-8000-000000000001';
