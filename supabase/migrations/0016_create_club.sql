-- Onboarding a new club from the Hub in one atomic step: the club row, its
-- billing row (standard 99 EUR plan), the standard karate belt ladder, and
-- optionally its domain. Done as one function rather than four client-side
-- inserts so a failure halfway can't leave a half-created club behind.
create or replace function create_club(
  p_name text,
  p_slug text,
  p_default_locale text default 'bg',
  p_hostname text default null,
  p_monthly_price_cents int default 9900
)
returns clubs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club clubs;
begin
  if not is_platform_admin() then
    raise exception 'Only platform admins can create clubs';
  end if;

  insert into clubs (name, slug, default_locale, status)
  values (p_name, p_slug, p_default_locale, 'draft')
  returning * into v_club;

  insert into club_billing (club_id, plan, monthly_price_cents)
  values (v_club.id, 'basic', p_monthly_price_cents);

  insert into belts (club_id, rank, name_bg, name_en, color_hex) values
    (v_club.id, 0, 'Бяло', 'White', '#F6F3EC'),
    (v_club.id, 1, 'Жълто', 'Yellow', '#F2C230'),
    (v_club.id, 2, 'Оранжево', 'Orange', '#F08A24'),
    (v_club.id, 3, 'Зелено', 'Green', '#2E9E5B'),
    (v_club.id, 4, 'Синьо', 'Blue', '#2C6DB5'),
    (v_club.id, 5, 'Кафяво', 'Brown', '#7A4A2B'),
    (v_club.id, 6, 'Черно', 'Black', '#0B0B0D');

  if p_hostname is not null and length(trim(p_hostname)) > 0 then
    insert into club_domains (club_id, hostname) values (v_club.id, lower(trim(p_hostname)));
  end if;

  return v_club;
end;
$$;

revoke all on function create_club(text, text, text, text, int) from public;
grant execute on function create_club(text, text, text, text, int) to authenticated;
