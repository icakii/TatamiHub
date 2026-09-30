-- Supports launch pricing: an optional discounted first-month price, then
-- the standard recurring monthly price after that. Tracking only for now —
-- no real payment processing, TatamiHub's Billing screen just records what
-- each club owes and when they last paid.
alter table club_billing add column if not exists first_month_price_cents int;

comment on column club_billing.monthly_price_cents is
  'Standard recurring monthly price, charged after any first-month intro price.';
comment on column club_billing.first_month_price_cents is
  'Optional discounted price for the first billing period only (e.g. launch pricing). Null means no intro discount.';
