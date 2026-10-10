-- Orders placed on the public Tatami site. A customer (any signed-up user,
-- not a club member) fills in their club details, pays the first month
-- through Paddle, and the founders pick the order up from the Hub.
--
-- Customers can create and read their own orders but never change them:
-- payment state is written by the paddle-webhook function (service role),
-- cancellation goes through the cancel-order function, and everything else
-- is a founder action from the Hub.

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  contact_name text not null check (char_length(contact_name) between 2 and 120),
  email text not null check (char_length(email) between 5 and 200),
  phone text check (char_length(phone) <= 40),
  club_name text not null check (char_length(club_name) between 2 and 120),
  city text check (char_length(city) <= 80),
  student_count int check (student_count between 0 and 5000),
  domain_option text not null check (domain_option in ('subdomain', 'own', 'new')),
  domain text check (char_length(domain) <= 120),
  notes text check (char_length(notes) <= 2000),
  terms_accepted_at timestamptz not null,
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'paid', 'in_progress', 'live', 'cancelled')),
  cancel_at date,
  paid_until date,
  paddle_customer_id text,
  paddle_subscription_id text,
  club_id uuid references clubs (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_user_id_idx on orders (user_id);
create index if not exists orders_subscription_idx on orders (paddle_subscription_id);

alter table orders enable row level security;

drop policy if exists orders_select on orders;
create policy orders_select on orders for select
using (user_id = auth.uid() or is_platform_admin());

-- A new order must belong to the caller and start unpaid with no payment
-- fields filled in, so nobody can insert themselves a "paid" order.
drop policy if exists orders_insert on orders;
create policy orders_insert on orders for insert
with check (
  user_id = auth.uid()
  and status = 'pending_payment'
  and paid_until is null
  and cancel_at is null
  and paddle_customer_id is null
  and paddle_subscription_id is null
  and club_id is null
);

drop policy if exists orders_admin_update on orders;
create policy orders_admin_update on orders for update
using (is_platform_admin())
with check (is_platform_admin());

drop policy if exists orders_admin_delete on orders;
create policy orders_admin_delete on orders for delete
using (is_platform_admin());

-- Spam guard: at most 3 unpaid orders per account at a time.
create or replace function orders_limit_pending()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    select count(*) from orders
    where user_id = new.user_id and status = 'pending_payment'
  ) >= 3 then
    raise exception 'Too many unpaid orders. Finish or cancel one first.';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_limit_pending on orders;
create trigger orders_limit_pending
before insert on orders
for each row execute function orders_limit_pending();

create or replace function orders_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists orders_touch_updated_at on orders;
create trigger orders_touch_updated_at
before update on orders
for each row execute function orders_touch_updated_at();
