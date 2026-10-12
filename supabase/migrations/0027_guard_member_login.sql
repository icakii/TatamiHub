-- With self-service, club staff can update student rows. Make sure that
-- never lets them attach or swap a login (user_id): only founders (Hub) or
-- the service role (create-member-account) may change it.
create or replace function members_guard_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is distinct from old.user_id
     and not is_platform_admin()
     and coalesce(current_setting('request.jwt.claims', true)::json ->> 'role', '') <> 'service_role'
     and current_user not in ('postgres', 'supabase_admin', 'service_role') then
    raise exception 'Logins are managed by Tatami';
  end if;
  return new;
end;
$$;

drop trigger if exists members_guard_user_id on members;
create trigger members_guard_user_id
before update on members
for each row execute function members_guard_user_id();
