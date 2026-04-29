alter table public.subscription_renewals
  add column if not exists new_cycle_months integer,
  add column if not exists cost_price numeric,
  add column if not exists collected_amount numeric,
  add column if not exists profit_amount numeric,
  add column if not exists notes text;

update public.subscription_renewals
set
  new_cycle_months = coalesce(
    new_cycle_months,
    case new_billing_cycle
      when '1month' then 1
      when '3months' then 3
      when '6months' then 6
      when '1year' then 12
      else null
    end
  ),
  collected_amount = coalesce(collected_amount, renewal_price, total_price, 0),
  cost_price = coalesce(cost_price, 0),
  profit_amount = coalesce(
    profit_amount,
    coalesce(collected_amount, renewal_price, total_price, 0) - coalesce(cost_price, 0)
  )
where
  new_cycle_months is null
  or collected_amount is null
  or cost_price is null
  or profit_amount is null;
