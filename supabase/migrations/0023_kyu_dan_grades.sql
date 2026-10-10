-- Belts become grades. Several grades can share a color (4 and 5 kyu are
-- both blue, 1-3 kyu brown, 1-10 dan black), so each grade is its own
-- belts row: name_* is the color, grade_* the grade ("3 кю"), and
-- color2_hex an optional stripe color (9 kyu is white-yellow).
alter table belts add column if not exists grade_bg text;
alter table belts add column if not exists grade_en text;
alter table belts add column if not exists color2_hex text;

-- Kime's ladder, as the club uses it:
--   10 кю бял · 9 кю бяло-жълт · 8 кю жълт · 7 кю оранжев · 6 кю зелен
--   5-4 кю син · 3-1 кю кафяв · 1-10 дан черен
-- Existing rows are kept (members point at them) and renumbered; class
-- belt ranges move with them. Ranks go via +100 first to dodge the
-- (club_id, rank) unique constraint while renumbering.
do $$
declare
  kime constant uuid := 'c1000000-0000-4000-8000-000000000001';
begin
  if exists (select 1 from belts where club_id = kime and grade_bg is not null) then
    return; -- already migrated
  end if;

  update classes set
    belt_min_rank = case belt_min_rank when 0 then 0 when 1 then 2 when 2 then 3 when 3 then 4 when 4 then 5 when 5 then 7 when 6 then 10 else belt_min_rank end,
    belt_max_rank = case belt_max_rank when 0 then 0 when 1 then 2 when 2 then 3 when 3 then 4 when 4 then 6 when 5 then 9 when 6 then 19 else belt_max_rank end
  where club_id = kime;

  update belts set rank = rank + 100 where club_id = kime;

  update belts set rank = 0,  grade_bg = '10 кю', grade_en = '10th kyu' where club_id = kime and rank = 100;
  update belts set rank = 2,  grade_bg = '8 кю',  grade_en = '8th kyu'  where club_id = kime and rank = 101;
  update belts set rank = 3,  grade_bg = '7 кю',  grade_en = '7th kyu'  where club_id = kime and rank = 102;
  update belts set rank = 4,  grade_bg = '6 кю',  grade_en = '6th kyu'  where club_id = kime and rank = 103;
  update belts set rank = 5,  grade_bg = '5 кю',  grade_en = '5th kyu'  where club_id = kime and rank = 104;
  update belts set rank = 7,  grade_bg = '3 кю',  grade_en = '3rd kyu'  where club_id = kime and rank = 105;
  update belts set rank = 10, grade_bg = '1 дан', grade_en = '1st dan'  where club_id = kime and rank = 106;

  insert into belts (club_id, rank, name_bg, name_en, color_hex, color2_hex, grade_bg, grade_en) values
    (kime, 1, 'Бяло-жълто', 'White-yellow', '#F6F3EC', '#F2C230', '9 кю', '9th kyu'),
    (kime, 6, 'Синьо', 'Blue', '#2C6DB5', null, '4 кю', '4th kyu'),
    (kime, 8, 'Кафяво', 'Brown', '#7A4A2B', null, '2 кю', '2nd kyu'),
    (kime, 9, 'Кафяво', 'Brown', '#7A4A2B', null, '1 кю', '1st kyu'),
    (kime, 11, 'Черно', 'Black', '#0B0B0D', null, '2 дан', '2nd dan'),
    (kime, 12, 'Черно', 'Black', '#0B0B0D', null, '3 дан', '3rd dan'),
    (kime, 13, 'Черно', 'Black', '#0B0B0D', null, '4 дан', '4th dan'),
    (kime, 14, 'Черно', 'Black', '#0B0B0D', null, '5 дан', '5th dan'),
    (kime, 15, 'Черно', 'Black', '#0B0B0D', null, '6 дан', '6th dan'),
    (kime, 16, 'Черно', 'Black', '#0B0B0D', null, '7 дан', '7th dan'),
    (kime, 17, 'Черно', 'Black', '#0B0B0D', null, '8 дан', '8th dan'),
    (kime, 18, 'Черно', 'Black', '#0B0B0D', null, '9 дан', '9th dan'),
    (kime, 19, 'Черно', 'Black', '#0B0B0D', null, '10 дан', '10th dan');
end $$;
