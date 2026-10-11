-- Clubs can now send an inquiry first: they describe what they want, we
-- talk, agree on any extras, and only then unlock payment from the Hub
-- (inquiry -> pending_payment). Paying straight away still works.
alter table orders drop constraint if exists orders_status_check;
alter table orders add constraint orders_status_check
  check (status in ('inquiry', 'pending_payment', 'paid', 'in_progress', 'live', 'cancelled'));

drop policy if exists orders_insert on orders;
create policy orders_insert on orders for insert
with check (
  user_id = auth.uid()
  and status in ('inquiry', 'pending_payment')
  and paid_until is null
  and cancel_at is null
  and paddle_customer_id is null
  and paddle_subscription_id is null
  and club_id is null
);

-- Spam guard now counts open inquiries too.
create or replace function orders_limit_pending()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    select count(*) from orders
    where user_id = new.user_id and status in ('inquiry', 'pending_payment')
  ) >= 3 then
    raise exception 'Too many open orders. Finish or cancel one first.';
  end if;
  return new;
end;
$$;
