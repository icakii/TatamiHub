-- Lets the Paddle webhook find which club a payment belongs to: look up the
-- owner's email on customer.created/updated to learn paddle_customer_id,
-- then match subscription events back to the club by that id.
alter table club_billing add column if not exists paddle_customer_id text;
alter table club_billing add column if not exists paddle_subscription_id text;

create index if not exists club_billing_paddle_customer_id_idx
  on club_billing (paddle_customer_id);
