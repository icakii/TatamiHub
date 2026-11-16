-- First real client (2026-11-16): СК по карате „Спартак 14“ – Плевен.
-- Club row, billing (Клуб plan, 110 EUR), the Shotokan kyu/dan ladder
-- (same as Kime's), and the groups and trainings from their last published
-- schedule (2017-2018, an example until the club sends the current one).
-- Logins and students are added from the Hub/app. Safe to re-run.
do $$
declare
  v_club uuid;
  g1 uuid; g2 uuid; g3 uuid; g4 uuid; g5 uuid;
begin
  select id into v_club from clubs where slug = 'spartak';
  if v_club is not null then
    return;
  end if;

  insert into clubs (slug, name, default_locale, status, accent_color)
  values ('spartak', 'Спартак 14 – Плевен', 'bg', 'live', '#2b3fa8')
  returning id into v_club;

  insert into club_billing (club_id, plan, monthly_price_cents, build_fee_cents)
  values (v_club, 'club', 11000, 35000);

  insert into belts (club_id, rank, name_bg, name_en, color_hex, color2_hex, grade_bg, grade_en)
  select v_club, rank, name_bg, name_en, color_hex, color2_hex, grade_bg, grade_en
  from belts where club_id = 'c1000000-0000-4000-8000-000000000001';

  insert into groups (club_id, name, description, room) values
    (v_club, 'Начинаещи до 7 г.', 'Без колан', 'Зала „Спартак“') returning id into g1;
  insert into groups (club_id, name, description, room) values
    (v_club, 'Напреднали до 8 г.', 'От 9 кю', 'Зала „Спартак“') returning id into g2;
  insert into groups (club_id, name, description, room) values
    (v_club, 'Начинаещи 8-13 г.', 'Без колан и 9 кю', 'Зала „Спартак“') returning id into g3;
  insert into groups (club_id, name, description, room) values
    (v_club, 'Напреднали 8-13 г.', '8-4 кю', 'Зала „Спартак“') returning id into g4;
  insert into groups (club_id, name, description, room) values
    (v_club, 'Напреднали 13-18 г.', 'Всеки избира 3 дни', 'Зала „Спартак“') returning id into g5;

  -- weekday: 0 = Monday.
  insert into classes (club_id, title, weekday, start_time, duration_min, group_id) values
    (v_club, 'Начинаещи до 7 г.', 0, '17:30', 60, g1),
    (v_club, 'Начинаещи до 7 г.', 2, '17:30', 60, g1),
    (v_club, 'Напреднали до 8 г.', 1, '17:30', 75, g2),
    (v_club, 'Напреднали до 8 г.', 3, '17:30', 75, g2),
    (v_club, 'Начинаещи 8-13 г.', 0, '18:30', 75, g3),
    (v_club, 'Начинаещи 8-13 г.', 2, '18:30', 75, g3),
    (v_club, 'Напреднали 8-13 г.', 1, '18:30', 90, g4),
    (v_club, 'Напреднали 8-13 г.', 3, '18:30', 90, g4),
    (v_club, 'Напреднали 13-18 г.', 0, '16:00', 90, g5),
    (v_club, 'Напреднали 13-18 г.', 1, '16:00', 90, g5),
    (v_club, 'Напреднали 13-18 г.', 2, '16:00', 90, g5),
    (v_club, 'Напреднали 13-18 г.', 3, '16:00', 90, g5),
    (v_club, 'Напреднали 13-18 г. (сутрин)', 0, '10:00', 90, g5),
    (v_club, 'Напреднали 13-18 г. (сутрин)', 4, '10:00', 90, g5),
    (v_club, 'Напреднали 13-18 г. (вечер)', 1, '19:30', 90, g5),
    (v_club, 'Напреднали 13-18 г. (вечер)', 3, '19:30', 90, g5);
end $$;
