-- The owner@kime.demo row in seed.sql inserts directly into auth.users but
-- never creates the matching auth.identities row current GoTrue versions
-- expect, leaving it permanently broken for any Auth API call ("Database
-- error loading user"/"checking email") -- not just password updates.
-- Delete it here; it gets recreated properly via the Admin API (which
-- correctly writes both tables) in scripts/set-demo-password.ts.
update payments set recorded_by = null where recorded_by = 'a1000000-0000-4000-8000-000000000001';
delete from auth.identities where user_id = 'a1000000-0000-4000-8000-000000000001';
delete from auth.users where id = 'a1000000-0000-4000-8000-000000000001';
