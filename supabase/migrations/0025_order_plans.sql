-- Plan ladder: Сайт / Клуб / Клуб Pro have fixed prices and can be paid
-- straight away; Онлайн магазин and Custom система are quoted, so those can
-- only arrive as an inquiry.
alter table orders add column if not exists plan text not null default 'club'
  check (plan in ('site', 'club', 'club_pro', 'store', 'custom'));

drop policy if exists orders_insert on orders;
create policy orders_insert on orders for insert
with check (
  user_id = auth.uid()
  and status in ('inquiry', 'pending_payment')
  and (plan in ('site', 'club', 'club_pro') or status = 'inquiry')
  and paid_until is null
  and cancel_at is null
  and paddle_customer_id is null
  and paddle_subscription_id is null
  and club_id is null
);
