-- 1) Dues reminders: remember when a student was last emailed so the
--    send-dues-reminder function can throttle (one email per 14 days).
alter table members add column if not exists last_reminder_at timestamptz;

-- 2) The "Клуб" plan (self-service) includes up to 75 active students.
--    Only enforced for staff adding students themselves; founders (Hub) and
--    "Клуб Pro" clubs are not capped.
create or replace function members_club_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'student'
     and new.status <> 'left'
     and club_self_service(new.club_id)
     and not is_platform_admin()
     and (
       select count(*) from members
       where club_id = new.club_id and role = 'student' and status <> 'left'
         and id <> new.id
     ) >= 75 then
    raise exception 'Student limit reached for this plan (75). Upgrade to Club Pro.';
  end if;
  return new;
end;
$$;

drop trigger if exists members_club_plan_limit on members;
create trigger members_club_plan_limit
before insert or update of status on members
for each row execute function members_club_plan_limit();
