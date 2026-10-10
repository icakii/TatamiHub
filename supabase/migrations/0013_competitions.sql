-- Competitions: coach-writable, same operational exception as attendance
-- and class signups -- a coach adding "Regional Championship, March 15" and
-- registering competitors is day-to-day club content, not a structural
-- change, so it doesn't need to go through the Hub.

create table if not exists competitions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs (id) on delete cascade,
  name text not null,
  location text,
  event_date date not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists competitions_club_id_idx on competitions (club_id);

alter table competitions enable row level security;

-- Same public-read shape as belts/classes: anyone can see a live club's
-- upcoming competitions, not just logged-in members.
drop policy if exists competitions_select on competitions;
create policy competitions_select on competitions for select
using (
  is_platform_admin()
  or member_role(club_id) is not null
  or exists (select 1 from clubs where clubs.id = competitions.club_id and clubs.status = 'live')
);

drop policy if exists competitions_write on competitions;
create policy competitions_write on competitions for all
using (is_platform_admin() or is_club_staff(club_id))
with check (is_platform_admin() or is_club_staff(club_id));

-- One row per (competition, member): starts as a registration (category
-- only), gets placement/medal filled in after the event.
create table if not exists competition_entries (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs (id) on delete cascade,
  competition_id uuid not null references competitions (id) on delete cascade,
  member_id uuid not null references members (id) on delete cascade,
  category text,
  placement text,
  medal text check (medal in ('gold', 'silver', 'bronze')),
  note text,
  created_at timestamptz not null default now(),
  unique (competition_id, member_id)
);

create index if not exists competition_entries_club_id_idx on competition_entries (club_id);
create index if not exists competition_entries_member_id_idx on competition_entries (member_id);

alter table competition_entries enable row level security;

-- Entries (student names, results) stay club-internal -- not public, unlike
-- the competition event itself.
drop policy if exists competition_entries_select on competition_entries;
create policy competition_entries_select on competition_entries for select
using (
  is_platform_admin()
  or is_club_staff(club_id)
  or member_role(club_id) is not null
);

drop policy if exists competition_entries_write on competition_entries;
create policy competition_entries_write on competition_entries for all
using (is_platform_admin() or is_club_staff(club_id))
with check (is_platform_admin() or is_club_staff(club_id));
