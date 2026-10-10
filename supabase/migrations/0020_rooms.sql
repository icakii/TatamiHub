-- Hall / room number. A group usually trains in one hall; a single class
-- can override it (e.g. the Saturday open session in the big hall).
alter table groups add column if not exists room text check (char_length(room) <= 40);
alter table classes add column if not exists room text check (char_length(room) <= 40);
