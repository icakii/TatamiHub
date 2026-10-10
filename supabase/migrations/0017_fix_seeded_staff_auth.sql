-- Same problem 0010 fixed for owner@kime.demo: the coach and the two seeded
-- students were inserted straight into auth.users without the auth.identities
-- row GoTrue needs, so they can never log in. Drop only the rows that are
-- actually broken (no identity), clearing the references that don't cascade
-- first; scripts/fix-seeded-logins.ts recreates them through the Admin API.
create temporary table broken_seed_users on commit drop as
select u.id
from auth.users u
where u.id in (
  'a1000000-0000-4000-8000-000000000002',
  'a1000000-0000-4000-8000-000000000003',
  'a1000000-0000-4000-8000-000000000004'
)
and not exists (select 1 from auth.identities i where i.user_id = u.id);

update payments set recorded_by = null where recorded_by in (select id from broken_seed_users);
update member_notes set created_by = null where created_by in (select id from broken_seed_users);
update class_notices set created_by = null where created_by in (select id from broken_seed_users);
update announcements set created_by = null where created_by in (select id from broken_seed_users);
delete from auth.users where id in (select id from broken_seed_users);
