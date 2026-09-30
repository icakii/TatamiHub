-- Students never self-register: a coach/owner creates each student's login
-- directly (from the admin panel, via an Edge Function using the
-- service-role key) and links members.user_id at creation time. That makes
-- the invite-code/email self-claim path from 0002 dead code.
drop function if exists claim_member_by_code(text);
drop function if exists claim_member_by_email();

alter table members drop column if exists invite_code;
