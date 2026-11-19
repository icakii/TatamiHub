-- 1) Club join codes (2026-11-19). Students and parents register themselves
--    in the app with their club's code; no approval step. The coach sees the
--    code in the admin panel and can make a new one if it leaks.
create or replace function new_join_code()
returns text
language sql
volatile
as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
  from generate_series(1, 6)
$$;

alter table clubs add column if not exists join_code text unique check (join_code ~ '^[A-Z0-9]{6}$');
update clubs set join_code = new_join_code() where join_code is null;
alter table clubs alter column join_code set default new_join_code();

-- Only staff of the club (and we) may read it; clubs rows are public to the
-- app otherwise, so the code is served through these functions instead.
revoke select (join_code) on clubs from anon, authenticated;

create or replace function club_join_code(p_club_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (is_platform_admin() or is_club_staff(p_club_id)) then
    raise exception 'Not allowed';
  end if;
  return (select join_code from clubs where id = p_club_id);
end;
$$;

create or replace function rotate_join_code(p_club_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if not (is_platform_admin() or is_club_staff(p_club_id)) then
    raise exception 'Not allowed';
  end if;
  loop
    v_code := new_join_code();
    begin
      update clubs set join_code = v_code where id = p_club_id;
      exit;
    exception when unique_violation then
      -- try another
    end;
  end loop;
  return v_code;
end;
$$;

revoke execute on function club_join_code(uuid) from public, anon;
revoke execute on function rotate_join_code(uuid) from public, anon;
grant execute on function club_join_code(uuid) to authenticated;
grant execute on function rotate_join_code(uuid) to authenticated;
revoke execute on function new_join_code() from public, anon, authenticated;

-- 2) One person, one ЕГН per club.
create unique index if not exists members_club_egn_unique on members (club_id, egn) where egn is not null;

-- 3) What running Tatami costs us every month (Finance page), planned and
--    active. The ledger keeps what was actually paid; this is the budget.
create table if not exists recurring_costs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  amount_cents int check (amount_cents >= 0),
  period text not null default 'monthly' check (period in ('monthly', 'yearly', 'one_time')),
  status text not null default 'planned' check (status in ('planned', 'active', 'stopped')),
  notes text check (char_length(notes) <= 1000),
  url text check (char_length(url) <= 300),
  author_name text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

drop trigger if exists recurring_costs_author on recurring_costs;
create trigger recurring_costs_author before insert on recurring_costs
for each row execute function stamp_author();

alter table recurring_costs enable row level security;
drop policy if exists recurring_costs_admin on recurring_costs;
create policy recurring_costs_admin on recurring_costs for all using (is_platform_admin()) with check (is_platform_admin());
