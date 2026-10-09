-- Lets a club's own owner read (not write) their club_billing row, so
-- KimeClub's admin panel can show a Subscription tab. Writes stay
-- platform-admin only (manual "Mark paid" in the Hub, or later a verified
-- Paddle webhook using the service-role key).
drop policy if exists club_billing_all on club_billing;

create policy club_billing_select on club_billing for select
using (is_platform_admin() or member_role(club_id) = 'owner');

create policy club_billing_write on club_billing for all
using (is_platform_admin())
with check (is_platform_admin());
