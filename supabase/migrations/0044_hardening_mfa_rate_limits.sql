-- Security pass 2026-11-20.

-- 1) Founders' access needs two-step login. A founder who has set up an
--    authenticator app only counts as admin in a session that passed the
--    second step (aal2), so a stolen password alone opens nothing. The Hub
--    makes every founder set one up on their next login; until they have,
--    their password still works (so nobody is locked out mid-rollout).
create or replace function is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from platform_admins where user_id = auth.uid())
    and (
      coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified'
      )
    );
$$;

-- For the Hub's login screen: is this signed-in person a founder at all,
-- before the second step? (Says nothing else; gives no access.)
create or replace function is_platform_admin_account()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from platform_admins where user_id = auth.uid());
$$;
revoke execute on function is_platform_admin_account() from public, anon;
grant execute on function is_platform_admin_account() to authenticated;

-- 2) Rate limits for the public functions (registration, code checks,
--    requests from the site), counted per IP and per key in fixed windows.
--    Only the service role (the functions) uses this table.
create table if not exists rate_limits (
  key text not null check (char_length(key) <= 200),
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (key, window_start)
);
alter table rate_limits enable row level security;
revoke all on rate_limits from anon, authenticated;

create or replace function hit_rate_limit(p_key text, p_max int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits int;
begin
  insert into rate_limits (key, window_start, hits) values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = rate_limits.hits + 1
  returning hits into v_hits;
  -- Housekeeping: forget windows older than a day.
  if random() < 0.02 then
    delete from rate_limits where window_start < now() - interval '1 day';
  end if;
  return v_hits <= p_max;
end;
$$;
revoke execute on function hit_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function hit_rate_limit(text, int, int) to service_role;

-- 3) Pin search_path on the remaining helper functions.
alter function new_checkin_token() set search_path = public;
alter function new_join_code() set search_path = public;
alter function orders_touch_updated_at() set search_path = public;
