-- Row Level Security for every table. General shape:
--   * platform admins can read/write everything
--   * club owners/coaches can read/write their own club's rows
--   * students can read their own member/payment/notification rows, plus
--     public club info (theme, belts, schedule)
--   * anonymous visitors can read only what the public landing page needs

alter table clubs enable row level security;
alter table club_domains enable row level security;
alter table belts enable row level security;
alter table members enable row level security;
alter table member_notes enable row level security;
alter table payments enable row level security;
alter table classes enable row level security;
alter table class_notices enable row level security;
alter table announcements enable row level security;
alter table notifications enable row level security;
alter table platform_admins enable row level security;
alter table club_billing enable row level security;

-- clubs ----------------------------------------------------------------
drop policy if exists clubs_select on clubs;
create policy clubs_select on clubs for select
using (
  status = 'live'
  or is_platform_admin()
  or member_role(id) is not null
);

drop policy if exists clubs_insert on clubs;
create policy clubs_insert on clubs for insert
with check (is_platform_admin());

drop policy if exists clubs_update on clubs;
create policy clubs_update on clubs for update
using (is_platform_admin() or member_role(id) = 'owner')
with check (is_platform_admin() or member_role(id) = 'owner');

drop policy if exists clubs_delete on clubs;
create policy clubs_delete on clubs for delete
using (is_platform_admin());

-- club_domains -----------------------------------------------------------
-- Public read: the app must resolve a club from window.location.hostname
-- before anyone is signed in.
drop policy if exists club_domains_select on club_domains;
create policy club_domains_select on club_domains for select
using (true);

drop policy if exists club_domains_write on club_domains;
create policy club_domains_write on club_domains for all
using (is_platform_admin())
with check (is_platform_admin());

-- belts --------------------------------------------------------------------
drop policy if exists belts_select on belts;
create policy belts_select on belts for select
using (
  is_platform_admin()
  or member_role(club_id) is not null
  or exists (select 1 from clubs where clubs.id = belts.club_id and clubs.status = 'live')
);

drop policy if exists belts_write on belts;
create policy belts_write on belts for all
using (is_platform_admin() or is_club_staff(club_id))
with check (is_platform_admin() or is_club_staff(club_id));

-- members --------------------------------------------------------------------
drop policy if exists members_select on members;
create policy members_select on members for select
using (
  is_platform_admin()
  or is_club_staff(club_id)
  or user_id = auth.uid()
);

drop policy if exists members_write on members;
create policy members_write on members for all
using (is_platform_admin() or is_club_staff(club_id))
with check (is_platform_admin() or is_club_staff(club_id));

-- member_notes: coach/owner/platform-admin only, never the member themselves
drop policy if exists member_notes_all on member_notes;
create policy member_notes_all on member_notes for all
using (is_platform_admin() or is_club_staff(club_id))
with check (is_platform_admin() or is_club_staff(club_id));

-- payments --------------------------------------------------------------------
drop policy if exists payments_select on payments;
create policy payments_select on payments for select
using (
  is_platform_admin()
  or is_club_staff(club_id)
  or exists (
    select 1 from members
    where members.id = payments.member_id and members.user_id = auth.uid()
  )
);

drop policy if exists payments_write on payments;
create policy payments_write on payments for all
using (is_platform_admin() or is_club_staff(club_id))
with check (is_platform_admin() or is_club_staff(club_id));

-- classes / class_notices: same public-read shape as belts
drop policy if exists classes_select on classes;
create policy classes_select on classes for select
using (
  is_platform_admin()
  or member_role(club_id) is not null
  or exists (select 1 from clubs where clubs.id = classes.club_id and clubs.status = 'live')
);

drop policy if exists classes_write on classes;
create policy classes_write on classes for all
using (is_platform_admin() or is_club_staff(club_id))
with check (is_platform_admin() or is_club_staff(club_id));

drop policy if exists class_notices_select on class_notices;
create policy class_notices_select on class_notices for select
using (
  is_platform_admin()
  or member_role(club_id) is not null
  or exists (select 1 from clubs where clubs.id = class_notices.club_id and clubs.status = 'live')
);

drop policy if exists class_notices_write on class_notices;
create policy class_notices_write on class_notices for all
using (is_platform_admin() or is_club_staff(club_id))
with check (is_platform_admin() or is_club_staff(club_id));

-- announcements: authoring table, staff/admin only (students read via
-- notifications instead, so drafts and per-belt targeting stay private)
drop policy if exists announcements_all on announcements;
create policy announcements_all on announcements for all
using (is_platform_admin() or is_club_staff(club_id))
with check (is_platform_admin() or is_club_staff(club_id));

-- notifications: the student's in-app inbox
drop policy if exists notifications_select on notifications;
create policy notifications_select on notifications for select
using (
  is_platform_admin()
  or is_club_staff(club_id)
  or exists (
    select 1 from members
    where members.id = notifications.member_id and members.user_id = auth.uid()
  )
);

drop policy if exists notifications_insert on notifications;
create policy notifications_insert on notifications for insert
with check (is_platform_admin() or is_club_staff(club_id));

-- Students may only mark their own notifications read; staff/admin can
-- update any (e.g. correcting a bad send).
drop policy if exists notifications_update on notifications;
create policy notifications_update on notifications for update
using (
  is_platform_admin()
  or is_club_staff(club_id)
  or exists (
    select 1 from members
    where members.id = notifications.member_id and members.user_id = auth.uid()
  )
)
with check (
  is_platform_admin()
  or is_club_staff(club_id)
  or exists (
    select 1 from members
    where members.id = notifications.member_id and members.user_id = auth.uid()
  )
);

drop policy if exists notifications_delete on notifications;
create policy notifications_delete on notifications for delete
using (is_platform_admin() or is_club_staff(club_id));

-- platform_admins: admins can see the admin list; nobody else can see or
-- change it (adding an admin is a manual/service-role operation).
drop policy if exists platform_admins_select on platform_admins;
create policy platform_admins_select on platform_admins for select
using (is_platform_admin());

-- club_billing: never visible to clubs, only us
drop policy if exists club_billing_all on club_billing;
create policy club_billing_all on club_billing for all
using (is_platform_admin())
with check (is_platform_admin());
