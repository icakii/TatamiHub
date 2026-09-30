-- Business decision: club staff (owner/coach) should not be able to change
-- membership data themselves — that stays with the platform admins, who the
-- coach contacts directly (call/text) to add a student, change a belt, etc.
-- This keeps the service's value with us instead of making the club fully
-- self-sufficient. Club staff keep read access to their own club's members
-- (RLS's members_select policy is untouched); they just lose write access.

alter table members add column if not exists guardian_first_name text;
alter table members add column if not exists guardian_last_name text;
alter table members add column if not exists guardian_phone text;
alter table members add column if not exists guardian_email text;

drop policy if exists members_write on members;
create policy members_write on members for all
using (is_platform_admin())
with check (is_platform_admin());
