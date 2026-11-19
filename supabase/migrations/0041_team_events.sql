-- Founders' calendar in the Hub (2026-11-19): our own events (meetings,
-- deadlines, client visits). The page also shows every club's competitions
-- and board tasks with a due date, so there's one place to look.
create table if not exists team_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  starts_on date not null,
  start_time time,
  ends_on date,
  location text check (char_length(location) <= 160),
  notes text check (char_length(notes) <= 4000),
  club_id uuid references clubs (id) on delete set null,
  kind text not null default 'event' check (kind in ('event', 'deadline', 'meeting', 'competition')),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  author_name text,
  created_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);
create index if not exists team_events_date_idx on team_events (starts_on);

drop trigger if exists team_events_author on team_events;
create trigger team_events_author before insert on team_events
for each row execute function stamp_author();

alter table team_events enable row level security;
drop policy if exists team_events_admin on team_events;
create policy team_events_admin on team_events for all using (is_platform_admin()) with check (is_platform_admin());

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table team_events; exception when duplicate_object then null; end;
  end if;
end $$;
