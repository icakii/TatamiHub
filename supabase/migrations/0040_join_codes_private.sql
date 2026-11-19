-- The join code can't live on clubs: that table is readable by everyone, and
-- a column-level revoke doesn't override the table-wide grant. Codes get
-- their own table that only club staff and we can read. Every club gets a
-- fresh code, since the first ones were briefly readable.
create table if not exists club_join_codes (
  club_id uuid primary key references clubs (id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9]{6}$') default new_join_code(),
  updated_at timestamptz not null default now()
);

alter table club_join_codes enable row level security;
drop policy if exists club_join_codes_staff on club_join_codes;
create policy club_join_codes_staff on club_join_codes for select
using (is_platform_admin() or is_club_staff(club_id));

alter table clubs drop column if exists join_code;
insert into club_join_codes (club_id) select id from clubs on conflict (club_id) do nothing;

-- New clubs get a code automatically.
create or replace function clubs_add_join_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into club_join_codes (club_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
drop trigger if exists clubs_join_code on clubs;
create trigger clubs_join_code after insert on clubs for each row execute function clubs_add_join_code();
revoke execute on function clubs_add_join_code() from public, anon, authenticated;

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
  return (select code from club_join_codes where club_id = p_club_id);
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
      insert into club_join_codes (club_id, code, updated_at) values (p_club_id, v_code, now())
      on conflict (club_id) do update set code = excluded.code, updated_at = now();
      exit;
    exception when unique_violation then
      -- that code is taken by another club, try again
    end;
  end loop;
  return v_code;
end;
$$;

revoke execute on function club_join_code(uuid) from public, anon;
revoke execute on function rotate_join_code(uuid) from public, anon;
grant execute on function club_join_code(uuid) to authenticated;
grant execute on function rotate_join_code(uuid) to authenticated;
