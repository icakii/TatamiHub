-- Correction: competitions/entries are NOT a coach self-service exception
-- like attendance turned out to be -- management stays Hub-only (founder-
-- gated), same as members/classes/groups/billing. Read access for club
-- staff/members is unchanged.
drop policy if exists competitions_write on competitions;
create policy competitions_write on competitions for all
using (is_platform_admin())
with check (is_platform_admin());

drop policy if exists competition_entries_write on competition_entries;
create policy competition_entries_write on competition_entries for all
using (is_platform_admin())
with check (is_platform_admin());
