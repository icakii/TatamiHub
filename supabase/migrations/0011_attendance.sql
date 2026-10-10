-- Attendance is a deliberate, scoped exception to the "coach can't
-- self-serve" rule from 0005/0007: marking who showed up to a session is
-- day-to-day operational work a coach has to be able to do themselves --
-- unlike structural changes (who exists, pricing, schedule), which stay
-- founder-gated through the Hub.

create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs (id) on delete cascade,
  class_id uuid not null references classes (id) on delete cascade,
  member_id uuid not null references members (id) on delete cascade,
  session_date date not null,
  status text not null check (status in ('present', 'absent')),
  marked_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, member_id, session_date)
);

create index if not exists attendance_club_id_idx on attendance (club_id);
create index if not exists attendance_member_id_idx on attendance (member_id);

alter table attendance enable row level security;

-- Students can see their own attendance history; club staff and platform
-- admins can see everyone's.
drop policy if exists attendance_select on attendance;
create policy attendance_select on attendance for select
using (
  is_platform_admin()
  or is_club_staff(club_id)
  or exists (
    select 1 from members
    where members.id = attendance.member_id and members.user_id = auth.uid()
  )
);

drop policy if exists attendance_write on attendance;
create policy attendance_write on attendance for all
using (is_platform_admin() or is_club_staff(club_id))
with check (is_platform_admin() or is_club_staff(club_id));
