-- GDPR: on first login to a club's app, the user (a parent, a student of 14+
-- or a coach) confirms they have read that club's privacy policy and terms.
-- One row per login, club and document version; a new version asks again.
-- This records that the information was given (art. 13 GDPR) and who
-- confirmed being the child's parent or guardian.
create table if not exists legal_acceptances (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  club_id uuid not null references clubs (id) on delete cascade,
  version text not null check (char_length(version) <= 20),
  as_guardian boolean not null default false,
  accepted_at timestamptz not null default now(),
  primary key (user_id, club_id, version)
);

alter table legal_acceptances enable row level security;

-- Your own acceptances; club staff see who in their club accepted; we see all.
drop policy if exists legal_acceptances_select on legal_acceptances;
create policy legal_acceptances_select on legal_acceptances for select
using (user_id = auth.uid() or is_club_staff(club_id) or is_platform_admin());

-- Only for yourself, and only in a club where you have a profile. Never
-- updated or deleted by users: it's a record.
drop policy if exists legal_acceptances_insert on legal_acceptances;
create policy legal_acceptances_insert on legal_acceptances for insert
with check (
  user_id = auth.uid()
  and exists (select 1 from members where members.club_id = legal_acceptances.club_id and members.user_id = auth.uid())
);
