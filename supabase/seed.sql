-- Demo data. Everything below is fictional (names, emails, phone numbers).
-- Run this after the migrations, against your own Supabase project.
--
-- The auth.users rows here exist only so members/payments can reference a
-- valid user_id for RLS testing (see supabase/tests/rls_test.sql). They are
-- not guaranteed to be sign-in-ready through the app, since Supabase's
-- internal auth tables vary slightly by project version. To test the real
-- sign-up flow, register normally through the app UI and then call
-- claim_member_by_code() with a seeded member's invite_code.

-- ---------------------------------------------------------------------------
-- Kime Karate Club (the real demo club)
-- ---------------------------------------------------------------------------
insert into clubs (id, slug, name, default_locale, theme, plan, status, online_payments_enabled, channels)
values (
  'c1000000-0000-4000-8000-000000000001',
  'kime',
  'Kime Karate Club',
  'bg',
  '{
    "colors": {"kuro": "#0E0E10", "shiro": "#F6F3EC", "aka": "#D2232A"},
    "logo": "enso",
    "hero_bg": "ДИСЦИПЛИНА. ФОКУС. ПОЯС ПО ПОЯС.",
    "hero_en": "DISCIPLINE. FOCUS. BELT BY BELT."
  }'::jsonb,
  'basic',
  'live',
  false,
  '{"in_app": true, "email": true, "viber": false, "sms": false}'::jsonb
)
on conflict (id) do nothing;

insert into club_domains (club_id, hostname) values
  ('c1000000-0000-4000-8000-000000000001', 'localhost')
on conflict (hostname) do nothing;

insert into belts (id, club_id, rank, name_bg, name_en, color_hex) values
  ('b1000000-0000-4000-8000-000000000000', 'c1000000-0000-4000-8000-000000000001', 0, 'Бяло', 'White', '#F6F3EC'),
  ('b1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 1, 'Жълто', 'Yellow', '#F2C230'),
  ('b1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001', 2, 'Оранжево', 'Orange', '#F08A24'),
  ('b1000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000001', 3, 'Зелено', 'Green', '#2E9E5B'),
  ('b1000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000001', 4, 'Синьо', 'Blue', '#2C6DB5'),
  ('b1000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000001', 5, 'Кафяво', 'Brown', '#7A4A2B'),
  ('b1000000-0000-4000-8000-000000000006', 'c1000000-0000-4000-8000-000000000001', 6, 'Черно', 'Black', '#0B0B0D')
on conflict (id) do nothing;

-- Fictional login accounts: 1 owner, 1 coach, 2 already-claimed students.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('a1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'owner@kime.demo', crypt('Demo1234!', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
  ('a1000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'coach@kime.demo', crypt('Demo1234!', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
  ('a1000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'student1@kime.demo', crypt('Demo1234!', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
  ('a1000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'student2@kime.demo', crypt('Demo1234!', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb)
on conflict (id) do nothing;

-- Owner + coach
insert into members (id, club_id, user_id, role, full_name, email, belt_id, status, joined_at, birth_year, guardian_consent, consent_at) values
  ('m1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'owner', 'Николай Тодоров', 'owner@kime.demo', 'b1000000-0000-4000-8000-000000000006', 'active', '2019-03-01', 1985, true, '2019-03-01'),
  ('m1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002', 'coach', 'Елена Дичева', 'coach@kime.demo', 'b1000000-0000-4000-8000-000000000006', 'active', '2020-01-15', 1990, true, '2020-01-15')
on conflict (id) do nothing;

-- 10 fictional students: 2 already linked to a login (student1/student2),
-- 8 created by the coach and waiting to be claimed via invite_code.
insert into members (id, club_id, user_id, role, full_name, email, belt_id, status, joined_at, birth_year, guardian_consent, consent_at, invite_code) values
  ('m1000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000003', 'student', 'Мартин Иванов', 'student1@kime.demo', 'b1000000-0000-4000-8000-000000000003', 'active', '2022-09-01', 2012, true, '2022-09-01', null),
  ('m1000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000004', 'student', 'Виктория Стоянова', 'student2@kime.demo', 'b1000000-0000-4000-8000-000000000002', 'active', '2023-02-10', 2013, true, '2023-02-10', null),
  ('m1000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000001', null, 'student', 'Георги Николов', 'georgi.n@example.bg', 'b1000000-0000-4000-8000-000000000000', 'trial', '2024-05-01', 2015, false, null, 'KIME-GN01'),
  ('m1000000-0000-4000-8000-000000000006', 'c1000000-0000-4000-8000-000000000001', null, 'student', 'Ивайла Петрова', 'ivayla.p@example.bg', 'b1000000-0000-4000-8000-000000000001', 'active', '2021-11-20', 2011, true, '2021-11-20', 'KIME-IP02'),
  ('m1000000-0000-4000-8000-000000000007', 'c1000000-0000-4000-8000-000000000001', null, 'student', 'Радослав Ангелов', 'rado.angelov@example.bg', 'b1000000-0000-4000-8000-000000000004', 'active', '2020-06-05', 2009, true, '2020-06-05', 'KIME-RA03'),
  ('m1000000-0000-4000-8000-000000000008', 'c1000000-0000-4000-8000-000000000001', null, 'student', 'Симона Колева', 'simona.k@example.bg', 'b1000000-0000-4000-8000-000000000005', 'active', '2019-09-12', 2008, true, '2019-09-12', 'KIME-SK04'),
  ('m1000000-0000-4000-8000-000000000009', 'c1000000-0000-4000-8000-000000000001', null, 'student', 'Даниел Христов', 'daniel.h@example.bg', 'b1000000-0000-4000-8000-000000000000', 'trial', '2024-08-20', 2016, false, null, 'KIME-DH05'),
  ('m1000000-0000-4000-8000-00000000000a', 'c1000000-0000-4000-8000-000000000001', null, 'student', 'Кристина Георгиева', 'kristina.g@example.bg', 'b1000000-0000-4000-8000-000000000002', 'paused', '2021-01-08', 2010, true, '2021-01-08', 'KIME-KG06'),
  ('m1000000-0000-4000-8000-00000000000b', 'c1000000-0000-4000-8000-000000000001', null, 'student', 'Борис Марков', 'boris.markov@example.bg', 'b1000000-0000-4000-8000-000000000003', 'active', '2022-03-14', 2012, true, '2022-03-14', 'KIME-BM07'),
  ('m1000000-0000-4000-8000-00000000000c', 'c1000000-0000-4000-8000-000000000001', null, 'student', 'Здравка Тодорова', 'zdravka.t@example.bg', 'b1000000-0000-4000-8000-000000000001', 'left', '2018-04-01', 2007, true, '2018-04-01', 'KIME-ZT08')
on conflict (id) do nothing;

insert into classes (id, club_id, title, weekday, start_time, duration_min, coach_member_id, belt_min_rank, belt_max_rank) values
  ('cl100000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Начинаещи', 1, '18:00', 60, 'm1000000-0000-4000-8000-000000000002', 0, 2),
  ('cl100000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001', 'Напреднали', 3, '19:00', 75, 'm1000000-0000-4000-8000-000000000002', 3, 6),
  ('cl100000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000001', 'Отворена тренировка', 5, '18:30', 90, 'm1000000-0000-4000-8000-000000000001', 0, 6)
on conflict (id) do nothing;

-- One "time changed" notice, feeds the red badge on the student home card.
insert into class_notices (club_id, class_id, effective_date, new_start_time, note, created_by) values
  ('c1000000-0000-4000-8000-000000000001', 'cl100000-0000-4000-8000-000000000001', current_date + interval '2 days', '19:00', 'Треньорът мести часа с един час напред тази седмица.', 'a1000000-0000-4000-8000-000000000002');

-- Payments for the 10 students, current calendar month, mixed statuses.
insert into payments (club_id, member_id, amount_cents, currency, method, period_start, period_end, status, recorded_by) values
  ('c1000000-0000-4000-8000-000000000001', 'm1000000-0000-4000-8000-000000000003', 4000, 'EUR', 'cash', date_trunc('month', now())::date, (date_trunc('month', now()) + interval '1 month' - interval '1 day')::date, 'paid', 'a1000000-0000-4000-8000-000000000001'),
  ('c1000000-0000-4000-8000-000000000001', 'm1000000-0000-4000-8000-000000000004', 4000, 'EUR', 'bank', date_trunc('month', now())::date, (date_trunc('month', now()) + interval '1 month' - interval '1 day')::date, 'paid', 'a1000000-0000-4000-8000-000000000001'),
  ('c1000000-0000-4000-8000-000000000001', 'm1000000-0000-4000-8000-000000000005', 4000, 'EUR', 'cash', date_trunc('month', now())::date, (date_trunc('month', now()) + interval '1 month' - interval '1 day')::date, 'due', 'a1000000-0000-4000-8000-000000000001'),
  ('c1000000-0000-4000-8000-000000000001', 'm1000000-0000-4000-8000-000000000006', 4000, 'EUR', 'card', date_trunc('month', now())::date, (date_trunc('month', now()) + interval '1 month' - interval '1 day')::date, 'paid', 'a1000000-0000-4000-8000-000000000001'),
  ('c1000000-0000-4000-8000-000000000001', 'm1000000-0000-4000-8000-000000000007', 4000, 'EUR', 'cash', date_trunc('month', now())::date, (date_trunc('month', now()) + interval '1 month' - interval '1 day')::date, 'overdue', 'a1000000-0000-4000-8000-000000000001'),
  ('c1000000-0000-4000-8000-000000000001', 'm1000000-0000-4000-8000-000000000008', 4000, 'EUR', 'bank', date_trunc('month', now())::date, (date_trunc('month', now()) + interval '1 month' - interval '1 day')::date, 'paid', 'a1000000-0000-4000-8000-000000000001'),
  ('c1000000-0000-4000-8000-000000000001', 'm1000000-0000-4000-8000-000000000009', 4000, 'EUR', 'cash', date_trunc('month', now())::date, (date_trunc('month', now()) + interval '1 month' - interval '1 day')::date, 'due', 'a1000000-0000-4000-8000-000000000001'),
  ('c1000000-0000-4000-8000-000000000001', 'm1000000-0000-4000-8000-00000000000a', 4000, 'EUR', 'cash', date_trunc('month', now())::date, (date_trunc('month', now()) + interval '1 month' - interval '1 day')::date, 'waived', 'a1000000-0000-4000-8000-000000000001'),
  ('c1000000-0000-4000-8000-000000000001', 'm1000000-0000-4000-8000-00000000000b', 4000, 'EUR', 'online', date_trunc('month', now())::date, (date_trunc('month', now()) + interval '1 month' - interval '1 day')::date, 'overdue', 'a1000000-0000-4000-8000-000000000001'),
  ('c1000000-0000-4000-8000-000000000001', 'm1000000-0000-4000-8000-00000000000c', 4000, 'EUR', 'cash', date_trunc('month', now())::date, (date_trunc('month', now()) + interval '1 month' - interval '1 day')::date, 'overdue', 'a1000000-0000-4000-8000-000000000001');

-- A welcome announcement + matching inbox notifications for the two claimed students.
insert into announcements (id, club_id, title, body_bg, body_en, audience, channels, created_by, sent_at) values
  ('an100000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Добре дошли', 'Добре дошли в Kime Karate Club! Очакваме ви на тренировка.', 'Welcome to Kime Karate Club! See you on the mat.', '{"all": true}'::jsonb, array['in_app'], 'a1000000-0000-4000-8000-000000000002', now());

insert into notifications (club_id, member_id, announcement_id, title, body) values
  ('c1000000-0000-4000-8000-000000000001', 'm1000000-0000-4000-8000-000000000003', 'an100000-0000-4000-8000-000000000001', 'Добре дошли', 'Добре дошли в Kime Karate Club! Очакваме ви на тренировка.'),
  ('c1000000-0000-4000-8000-000000000001', 'm1000000-0000-4000-8000-000000000004', 'an100000-0000-4000-8000-000000000001', 'Добре дошли', 'Добре дошли в Kime Karate Club! Очакваме ви на тренировка.');

-- What Kime pays us. Never visible to Kime's own owner/coach accounts.
insert into club_billing (club_id, plan, monthly_price_cents, build_fee_cents, paid_until, notes) values
  ('c1000000-0000-4000-8000-000000000001', 'basic', 2000, 30000, (current_date + interval '1 month')::date, 'Demo club, not a real paying customer.')
on conflict (club_id) do nothing;

-- ---------------------------------------------------------------------------
-- Second, minimal club used only to prove cross-club RLS isolation in
-- supabase/tests/rls_test.sql. Not a real demo, not shown anywhere in the UI.
-- ---------------------------------------------------------------------------
insert into clubs (id, slug, name, default_locale, plan, status) values
  ('c2000000-0000-4000-8000-000000000001', 'rls-test-club-b', 'RLS Test Club B', 'bg', 'basic', 'live')
on conflict (id) do nothing;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values (
  'a2000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'student@testclubb.demo', crypt('Demo1234!', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
)
on conflict (id) do nothing;

insert into members (id, club_id, user_id, role, full_name, status, joined_at) values
  ('m2000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'student', 'Test Student B', 'active', current_date)
on conflict (id) do nothing;

insert into payments (club_id, member_id, amount_cents, method, period_start, period_end, status) values
  ('c2000000-0000-4000-8000-000000000001', 'm2000000-0000-4000-8000-000000000001', 4000, 'cash', date_trunc('month', now())::date, (date_trunc('month', now()) + interval '1 month' - interval '1 day')::date, 'paid');

-- Coach-only note on one Kime student, used to prove students can never
-- read their own coach notes.
insert into member_notes (club_id, member_id, body, created_by) values
  ('c1000000-0000-4000-8000-000000000001', 'm1000000-0000-4000-8000-000000000003', 'Много добър напредък, готов е за следващия пояс.', 'a1000000-0000-4000-8000-000000000002');

-- Throwaway user with no membership anywhere, used only by
-- supabase/tests/rls_test.sql to exercise the platform-admin path.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values (
  'a3000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'rls-test-admin@platform.demo', crypt('Demo1234!', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- To make yourself a platform admin: sign up/in through TatamiHub once, find
-- your user id in Authentication -> Users in the Supabase dashboard, then
-- run (with your own id):
--   insert into platform_admins (user_id) values ('YOUR-AUTH-USER-UUID');
-- ---------------------------------------------------------------------------
