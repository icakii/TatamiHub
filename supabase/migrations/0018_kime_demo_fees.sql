-- Demo data only: give Kime's seeded students a monthly fee so the
-- payments screens (Hub and the club's admin panel) have something to show
-- and "Record payment" isn't disabled. Leaves any fee already set alone.
update members
set monthly_fee_cents = case
  when birth_year is not null and birth_year >= 2010 then 6000
  else 7000
end
where club_id = 'c1000000-0000-4000-8000-000000000001'
  and role = 'student'
  and monthly_fee_cents is null;
