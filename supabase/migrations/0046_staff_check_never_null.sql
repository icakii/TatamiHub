-- Security fix 2026-11-20. is_club_staff() returned NULL (not false) for
-- someone with no membership in the club. Row policies treat NULL as "no",
-- but in functions `if not (is_platform_admin() or is_club_staff(x))`
-- evaluates to NULL and the IF doesn't fire, so a signed-in user from
-- another club could read or rotate that club's join code and check-in
-- token, or edit its rules. Always answer true or false.
create or replace function is_club_staff(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(member_role(p_club_id) in ('owner', 'coach'), false);
$$;

-- Same guard for the club option check used next to it.
create or replace function club_option(p_club_id uuid, p_option text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case p_option
      when 'grades' then grades_enabled
      when 'qr_checkin' then qr_checkin_enabled
      when 'store' then store_enabled
      else false
    end
    from clubs where id = p_club_id
  ), false);
$$;
