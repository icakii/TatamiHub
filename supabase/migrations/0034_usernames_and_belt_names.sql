-- 1) Belt colours agree with "колан" (masculine): "Черен", not "Черно".
--    Labels read "1 дан · Черен", as coaches say "1-ви дан черен колан".
update belts set name_bg = case name_bg
    when 'Бяло' then 'Бял'
    when 'Бяло-жълто' then 'Бял-жълт'
    when 'Жълто' then 'Жълт'
    when 'Оранжево' then 'Оранжев'
    when 'Червено' then 'Червен'
    when 'Зелено' then 'Зелен'
    when 'Синьо' then 'Син'
    when 'Лилаво' then 'Лилав'
    when 'Кафяво' then 'Кафяв'
    when 'Черно' then 'Черен'
    else name_bg
  end
where name_bg in ('Бяло', 'Бяло-жълто', 'Жълто', 'Оранжево', 'Червено', 'Зелено', 'Синьо', 'Лилаво', 'Кафяво', 'Черно');

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
    (v_club.id, 0, 'Бял', 'White', '#F6F3EC'),
    (v_club.id, 1, 'Жълт', 'Yellow', '#F2C230'),
    (v_club.id, 2, 'Оранжев', 'Orange', '#F08A24'),
    (v_club.id, 3, 'Зелен', 'Green', '#2E9E5B'),
    (v_club.id, 4, 'Син', 'Blue', '#2C6DB5'),
    (v_club.id, 5, 'Кафяв', 'Brown', '#7A4A2B'),
    (v_club.id, 6, 'Черен', 'Black', '#0B0B0D');

  if p_hostname is not null and length(trim(p_hostname)) > 0 then
    insert into club_domains (club_id, hostname) values (v_club.id, lower(trim(p_hostname)));
  end if;

  return v_club;
end;
$$;

-- 2) Usernames instead of emails for children's logins ("maria.spartak").
--    Written only by the create-member-account function, so a coach can look
--    the username up later when a parent forgets it.
alter table members add column if not exists login_name text check (char_length(login_name) <= 120);

create or replace function members_guard_structure()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.role is distinct from old.role
      or new.club_id is distinct from old.club_id
      or new.login_name is distinct from old.login_name)
     and not is_platform_admin()
     and coalesce(current_setting('request.jwt.claims', true)::json ->> 'role', '') <> 'service_role'
     and current_user not in ('postgres', 'supabase_admin', 'service_role') then
    raise exception 'Roles, clubs and logins are managed by Tatami';
  end if;
  return new;
end;
$$;

-- Existing logins keep their email as the login.
update members m set login_name = u.email
from auth.users u
where u.id = m.user_id and m.login_name is null;
