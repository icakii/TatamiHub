-- Demo data only: halls for Kime's seeded groups and the open session.
update groups set room = 'Зала 1' where id = 'a4000000-0000-4000-8000-000000000001' and room is null;
update groups set room = 'Зала 2' where id = 'a4000000-0000-4000-8000-000000000002' and room is null;
update classes set room = 'Голямата зала' where id = 'e1000000-0000-4000-8000-000000000003' and room is null;
