alter table if exists public.subscription_renewals
  add column if not exists new_product_id uuid null,
  add column if not exists new_product_name_snapshot text null,
  add column if not exists new_product_duration_months integer null,
  add column if not exists new_product_sell_price_vnd numeric null,
  add column if not exists new_product_buy_price_vnd numeric null;

create index if not exists idx_subscription_renewals_new_product_id
  on public.subscription_renewals (new_product_id);

create index if not exists idx_subscription_renewals_status_subscription
  on public.subscription_renewals (account_id, original_subscription_id, status, created_at desc);
