-- Audit 2026-11-18.
-- 1) Students may only mark their own notifications read, not rewrite the
--    title or text. Staff never edit sent notifications (they delete them).
revoke update on notifications from authenticated, anon;
grant update (read_at) on notifications to authenticated;

-- 2) Internal helpers that anonymous visitors have no reason to call.
--    (Trigger functions run regardless of EXECUTE grants.)
revoke execute on function admin_display_name() from public, anon;
revoke execute on function stamp_author() from public, anon, authenticated;
revoke execute on function members_guard_structure() from public, anon, authenticated;
revoke execute on function members_guard_user_id() from public, anon, authenticated;
revoke execute on function orders_limit_pending() from public, anon, authenticated;
revoke execute on function create_club(text, text, text, text, int) from public, anon;
grant execute on function admin_display_name() to authenticated;
