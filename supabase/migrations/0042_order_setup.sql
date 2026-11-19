-- The club's setup, sent with the request (2026-11-19): halls, groups and
-- their times, coaches, belt system, extras and colour. Structured, so we
-- can set the club up from it without a back-and-forth.
alter table orders add column if not exists setup jsonb check (setup is null or jsonb_typeof(setup) = 'object');
