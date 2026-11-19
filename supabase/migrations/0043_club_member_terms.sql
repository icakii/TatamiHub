-- Club rules / consent form (2026-11-19), modelled on the paper "Форма за
-- съгласие от родител/настойник" clubs use: data for the federation and
-- competitions, training rules, fees, health, risks, withdrawing consent.
-- Each club has its own text (the coach edits it); parents accept it with
-- the registration tick. Photo publication is a separate, optional consent.
alter table clubs add column if not exists member_terms text check (char_length(member_terms) <= 20000);
alter table clubs add column if not exists member_terms_updated_at timestamptz;

alter table legal_acceptances add column if not exists club_terms_at timestamptz;
alter table legal_acceptances add column if not exists photo_consent boolean;

-- Coaches may edit only these two columns of their club (clubs updates are
-- otherwise ours alone).
create or replace function set_member_terms(p_club_id uuid, p_terms text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
begin
  if not (is_platform_admin() or is_club_staff(p_club_id)) then
    raise exception 'Not allowed';
  end if;
  if char_length(p_terms) > 20000 then
    raise exception 'Too long';
  end if;
  update clubs set member_terms = nullif(trim(p_terms), ''), member_terms_updated_at = v_now where id = p_club_id;
  return v_now;
end;
$$;
revoke execute on function set_member_terms(uuid, text) from public, anon;
grant execute on function set_member_terms(uuid, text) to authenticated;
