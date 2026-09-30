-- Helper functions reused by RLS policies. Both are STABLE + SECURITY DEFINER
-- so a policy can call them without recursing back into the RLS it's
-- evaluating (e.g. members policies calling member_role(), which itself
-- reads the members table).

create or replace function is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from platform_admins where user_id = auth.uid()
  );
$$;

create or replace function member_role(p_club_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from members
  where club_id = p_club_id and user_id = auth.uid()
  limit 1;
$$;

create or replace function is_club_staff(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select member_role(p_club_id) in ('owner', 'coach');
$$;

-- Lets a freshly-registered student link themselves to the members row a
-- coach already created for them, using a one-time invite code. Runs as
-- SECURITY DEFINER so it can update `members` (normally staff-only) but is
-- scoped tightly: only an unclaimed row matching the exact code can move.
create or replace function claim_member_by_code(p_invite_code text)
returns members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member members;
begin
  update members
  set user_id = auth.uid(), invite_code = null
  where invite_code = p_invite_code and user_id is null
  returning * into v_member;

  if v_member.id is null then
    raise exception 'Invalid or already-used invite code';
  end if;

  return v_member;
end;
$$;

-- Same idea, but matches by the email the student registered with instead
-- of a code, for clubs that prefer inviting by email.
create or replace function claim_member_by_email()
returns members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member members;
  v_email text := auth.jwt() ->> 'email';
begin
  if v_email is null then
    raise exception 'No email on the current session';
  end if;

  update members
  set user_id = auth.uid()
  where lower(email) = lower(v_email) and user_id is null
  returning * into v_member;

  if v_member.id is null then
    raise exception 'No unclaimed member found for this email';
  end if;

  return v_member;
end;
$$;

revoke all on function claim_member_by_code(text) from public;
revoke all on function claim_member_by_email() from public;
grant execute on function claim_member_by_code(text) to authenticated;
grant execute on function claim_member_by_email() to authenticated;
