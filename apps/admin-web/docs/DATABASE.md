# Database Schema - ManagerOrder

> Live Supabase snapshot reviewed on 2026-04-17.

## Snapshot

The live database is a mixed schema. The app uses `accounts` as the tenant root, with `admin_users` mapping users to accounts. The `premium_*` module exists, but should be treated as a separate domain and not assumed to be the tenant root for short-link or core identity.

## Live Truth

### Core Identity

| Table | Live role | Notes |
|---|---|---|
| `accounts` | Tenant root | Live table with business profile fields such as `email`, `phone`, `address`, `business_name`, `business_type`, `tax_id`, `plan_type`, `subscription_expires_at`, `settings` |
| `admin_users` | User-to-tenant mapping | Live table with `account_id`, role, status, and profile fields |

### Sales and Short-Link

| Table | Live role | Notes |
|---|---|---|
| `sales_channels` | Sales channel registry | Live table is still minimal in schema; should remain tenant-scoped by `accounts.id` |
| `short_links` | Public share links | Live table is still minimal; delivery mode and landing metadata are not fully live yet |
| `short_link_clicks` | Click analytics | Live table already contains extra analytics columns such as `city`, `country_region`, `ip_version`, `browser` |

### Business Domain

| Table | Live role | Notes |
|---|---|---|
| `customers` | Customer master | Live table includes RFM/debt fields plus `phone` and `email` |
| `customer_groups` | Customer grouping | Live table includes `color`, `description`, `rules`, `deleted_at` |
| `customer_tags` | Customer tagging | Live table includes the compact tag model with `color` |
| `customer_tag_assignments` | Customer-tag join | Live table uses `customer_id`, `tag_id`, `assigned_at` |
| `orders` | Order aggregate | Live table includes a hard FK on `sales_channel_id`, plus payment source linkage, snapshots, and financial totals |
| `products` | Product catalog | Live table includes price/cost fields and duration metadata |
| `providers` | Provider registry | Live table includes contacts, tier, reliability, debt, and contact email |
| `source_accounts` | Inventory source accounts | Live table includes product allocation, reserved nicks, purchase metadata, status; live API does not expose an `accounts` FK relation |
| `purchase_orders` | Buy-side purchase orders | Live table has FKs to `accounts` and `providers`, plus JSON line items |
| `provider_product_prices` | Provider cost matrix | Live table has FKs to `accounts`, `providers`, and `products` |

### Settings and Bot Runtime

| Table | Live role | Notes |
|---|---|---|
| `reminder_config` | Reminder template config | Live table links to `accounts` and stores channel/template defaults |
| `reminder_events` | Reminder schedule items | Live table is present but exposes no FK relations in live API |
| `reminder_logs` | Reminder delivery log | Live table links to `accounts`, `orders`, and `customers` |
| `activity_logs` | Activity audit trail | Live table links to `accounts`, `customers`, `orders`, and `source_accounts` |
| `system_settings` | Settings snapshot | Live table is present but does not expose an `accounts` FK relation |
| `bot_user_contacts` | Bot contact registry | Live table links to `accounts` and `customers` |
| `bot_sessions` | Bot session mode | Live table links to `customers` and stores `zalo_user_id`/pause state |
| `bot_error_logs` | Bot error log | Live table links to `customers` and stores `status`/`resolved_at` |

### Premium Module

| Table | Live role | Notes |
|---|---|---|
| `premium_service_types` | Premium service catalog | Present in live schema |
| `premium_packages` | Premium package catalog | Present in live schema |
| `premium_accounts` | Premium account inventory | Present in live schema, but must be isolated from core identity assumptions |
| `premium_account_users` | Sub-user assignment | Present in live schema |
| `customer_premium_subscriptions` | Customer subscriptions | Present in live schema |
| `premium_account_health_logs` | Connection health audit | Present in live schema |
| `premium_account_user_history` | Audit trail for account-user changes | Present in live schema |

## Type Drift Observed

These are the main mismatches found between `database.types.ts` and live schema:

- `accounts`
  - live: `email`, `phone`, `address`, `business_name`, `business_type`, `tax_id`, `plan_type`, `subscription_expires_at`, `settings`, `notes`
  - types: older `owner_email`-centric shape
- `sales_channels`
  - live: minimal columns only
  - types: already models `default_delivery_mode` and `default_landing_template_key`
- `short_links`
  - live: minimal columns only
  - types: already models `sales_channel_id`, `delivery_mode`, `landing_template_key`
- `short_link_clicks`
  - live: already includes analytics fields `city`, `country_region`, `ip_version`, `browser`
  - types: includes `event_type`, but live snapshot must be checked before relying on it

## Normalize In This Order

1. `core identity`
   - lock `accounts` as tenant root
   - make `admin_users` the only mapping layer for authenticated tenant resolution
   - resolve RLS tenant helpers from the Supabase JWT email claim, because `admin_users.id` is an app UUID rather than the Supabase auth uid
   - keep RLS helpers guarded, never hard-fail when a table is absent
2. `short-link`
   - standardize `sales_channels`
   - standardize `short_links`
   - preserve `short_link_clicks` analytics fields
   - avoid hard FK assumptions for `customer_id` until live types are confirmed
3. `customers`
   - align customer/contact/tag/group relation columns
4. `orders`
   - align `sales_channel_id`, status history, payments, refund flow
5. `products / providers / source_accounts`
   - align inventory and allocation relationships
6. `settings / bot runtime`
   - align reminder config, activity logs, bot contacts, session state, and error tracking
7. `premium module`
   - normalize separately from core business tables

## Migration Rules

- Prefer `to_regclass(...)` guards before touching a table.
- Use `NOT VALID` on FKs when backfilling from legacy live data.
- Do not infer a foreign key from generated types alone.
- If live and generated types disagree, live schema wins for migration design.
- Keep API compatibility in the application layer until the schema is stable.

## Next Domain Checklist

### Customers

- Compare live columns to `database.types.ts`
- Verify `customer_contacts`, `customer_tags`, `customer_tag_assignments`, `customer_groups`
- Confirm whether `customer_id` foreign keys are type-safe in live DB

### Orders

- Verify `order_items`, `order_status_history`, `payments`, `refund_requests`
- Confirm `sales_channel_id` behavior and nullability
- Confirm whether `payment_sources` is tenant-scoped through `accounts`

### Inventory

- Verify `source_accounts`, `license_keys`
- Verify allocation RPCs and index coverage
- Verify `reminder_config`, `reminder_logs`, `activity_logs`, `bot_user_contacts`, `bot_sessions`, `bot_error_logs`
- Confirm live relations for reminder and bot tables before adding any new FK guard migrations

### Premium

- Verify `premium_accounts`, `premium_account_users`, `customer_premium_subscriptions`
- Only normalize after core identity and short-link are stable

## Related Docs

- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [PLAN-admin-upgrade.md](./PLAN-admin-upgrade.md)
