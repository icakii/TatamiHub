-- Competitions run by the coach (2026-11-19): date, start time, place, notes
-- and the disciplines on offer. Once the coach opens sign-ups, a student (or
-- the parent, for their children) signs up in the app and picks one
-- discipline; the coach sees the list in the admin panel.
alter table competitions add column if not exists start_time time;
alter table competitions add column if not exists disciplines text[] not null
  default array['Ката', 'Кумите', 'Отборно ката', 'Отборно кумите'];
alter table competitions add column if not exists registration_open boolean not null default false;
alter table competitions add column if not exists updated_at timestamptz not null default now();
alter table competitions drop constraint if exists competitions_disciplines_check;
alter table competitions add constraint competitions_disciplines_check check (cardinality(disciplines) between 1 and 12);

-- The chosen discipline goes in competition_entries.category (already there).
-- Who signed up, and when, for the coach's list.
alter table competition_entries add column if not exists signed_up_by uuid references auth.users (id) on delete set null;

-- Students/parents: sign up their own child for an open, upcoming
-- competition, in one of its disciplines, without results filled in.
drop policy if exists competition_entries_signup on competition_entries;
create policy competition_entries_signup on competition_entries for insert
with check (
  owns_member(member_id)
  and signed_up_by = auth.uid()
  and placement is null and medal is null and note is null
  and exists (
    select 1 from competitions c
    where c.id = competition_entries.competition_id
      and c.club_id = competition_entries.club_id
      and c.registration_open
      and c.event_date >= current_date
      and competition_entries.category = any (c.disciplines)
  )
);

-- ...and withdraw again while sign-ups are open and no result is in.
drop policy if exists competition_entries_withdraw on competition_entries;
create policy competition_entries_withdraw on competition_entries for delete
using (
  owns_member(member_id)
  and placement is null and medal is null
  and exists (
    select 1 from competitions c
    where c.id = competition_entries.competition_id and c.registration_open and c.event_date >= current_date
  )
);
