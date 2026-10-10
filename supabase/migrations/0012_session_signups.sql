-- A student's own advance "I'm coming" declaration for a specific session,
-- deliberately separate from attendance (the coach's post-session record of
-- who actually showed up). Different actor, different time, different
-- table -- mixing them would conflate "I plan to come" with "I showed up."
create table if not exists session_signups (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs (id) on delete cascade,
  class_id uuid not null references classes (id) on delete cascade,
  member_id uuid not null references members (id) on delete cascade,
  session_date date not null,
  created_at timestamptz not null default now(),
  unique (class_id, member_id, session_date)
);

create index if not exists session_signups_club_id_idx on session_signups (club_id);
create index if not exists session_signups_member_id_idx on session_signups (member_id);

alter table session_signups enable row level security;

-- A student may only sign up/cancel their own row; staff/admin can see and
-- manage everyone's (e.g. to gauge expected headcount).
drop policy if exists session_signups_all on session_signups;
create policy session_signups_all on session_signups for all
using (
  is_platform_admin()
  or is_club_staff(club_id)
  or exists (
    select 1 from members
    where members.id = session_signups.member_id and members.user_id = auth.uid()
  )
)
with check (
  is_platform_admin()
  or is_club_staff(club_id)
  or exists (
    select 1 from members
    where members.id = session_signups.member_id and members.user_id = auth.uid()
  )
);
