-- Groups let a club split students by age/skill/whatever else makes sense
-- (free-text description, not fixed fields — a club might group by age,
-- by belt range, by weekday, or something else entirely). Created from
-- TatamiHub only, same "coach can't self-serve structural changes" rule
-- as members. A student's own schedule page filters to their group; an
-- ungrouped class (group_id null) stays visible to everyone.

create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs (id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists groups_club_id_idx on groups (club_id);

alter table members add column if not exists group_id uuid references groups (id) on delete set null;
alter table classes add column if not exists group_id uuid references groups (id) on delete set null;

alter table groups enable row level security;

drop policy if exists groups_select on groups;
create policy groups_select on groups for select
using (
  is_platform_admin()
  or member_role(club_id) is not null
  or exists (select 1 from clubs where clubs.id = groups.club_id and clubs.status = 'live')
);

drop policy if exists groups_write on groups;
create policy groups_write on groups for all
using (is_platform_admin())
with check (is_platform_admin());

-- Classes were still coach/owner-writable from 0003 — tighten to match the
-- same rule members got in 0005. The schedule itself is now Hub-managed too.
drop policy if exists classes_write on classes;
create policy classes_write on classes for all
using (is_platform_admin())
with check (is_platform_admin());

drop policy if exists class_notices_write on class_notices;
create policy class_notices_write on class_notices for all
using (is_platform_admin())
with check (is_platform_admin());
