-- Per-student dues amount (varies per student/category, e.g. kids vs
-- adults -- not one flat club-wide price). Founder-set, same as every other
-- structural member field; recording that a payment was actually made is
-- the separate, already-coach-writable `payments` table.
alter table members add column if not exists monthly_fee_cents int;
