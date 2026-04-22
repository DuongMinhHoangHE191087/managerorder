# Database Roadmap - Live Truth First

> Scope: normalize the live Supabase schema in safe phases, based on the current database snapshot and `src/lib/supabase/database.types.ts`.

## Current Baseline

- `accounts` is the tenant root.
- `admin_users` is the tenant mapping layer.
- `sales_channels` is live but minimal.
- `short_links` is live but still minimal for the new public flow.
- `short_link_clicks` already has extended analytics columns in live DB.
- `source_accounts` stays app-level in live API; it does not expose `accounts` or `integrations` FK relations.
- `reminder_config`, `reminder_logs`, `activity_logs`, `bot_user_contacts`, `bot_sessions`, and `bot_error_logs` are live bot/settings runtime tables that need to stay aligned with `database.types.ts`.
- The premium module exists, but it should stay isolated from core identity normalization.

## Phase Order

### 1. Core Identity

Goal:
- lock tenant resolution to `accounts` + `admin_users`
- make RLS helpers safe when optional tables are absent

Tables:
- `accounts`
- `admin_users`
- `profiles` if needed as a compatibility layer

Rules:
- never assume `premium_accounts` is the tenant root
- keep `get_user_account_id()` guarded with `to_regclass('public.admin_users')`
- resolve tenant identity from the Supabase JWT email claim first; keep `auth.uid()` only as a legacy fallback when an older environment still relies on it
- avoid hard policy failures when a table is missing in a non-unified environment

### 2. Short-Link

Goal:
- normalize public share behavior without breaking current links
- support channel inheritance and landing-page routing

Tables:
- `sales_channels`
- `short_links`
- `short_link_clicks`

Live-safe decisions:
- `sales_channels.account_id` references `accounts.id`
- `short_links.account_id` references `accounts.id`
- `short_links.sales_channel_id` stays nullable
- `short_links.customer_id` stays unconstrained until all environments agree on the same ID type
- `short_links.order_id` only gets a FK when `orders` is present

### 3. Customers

Goal:
- align customer identity, contacts, groups, tags, and assignment tables

Tables:
- `customers`
- `customer_contacts`
- `customer_groups`
- `customer_tags`
- `customer_tag_assignments`

Confirmed live-vs-types notes:
- `customers`
  - live includes `phone` and `email`
  - generated types now need to stay in sync with those nullable contact fields
- `customer_contacts`
  - live shape matches the generated model closely
- `customer_groups`
  - present in the live DB and already referenced by RLS/index policy
  - verify columns before making any schema change because the table may be sparse in the snapshot
  - live shape includes `rules` and `deleted_at`; generated types now need to match that compatibility layer
- `customer_tags`
  - live shape matches the generated model closely
- `customer_tag_assignments`
  - live uses `customer_id`, `tag_id`, `assigned_at`
  - generated types were updated to remove `id` and use `assigned_at`

Guarded migration:
- `20260408090000_compat_zalo_auth_soft_delete.sql`
  - backfills `customers.phone` and `customers.email`
  - adds `customer_groups.rules` and `customer_groups.deleted_at`
  - adds `customer_tag_assignments.assigned_at`
  - keeps `customer_tags` compatible with the live minimal shape

### 4. Orders

Goal:
- align order state, history, payments, refunds, and channel linkage

Tables:
- `orders`
- `order_items`
- `order_status_history`
- `payments`
- `refund_requests`
- `subscription_renewals`

Verified live query coverage:
- `payments` matches the migration-defined shape in `20260312_payments.sql`
- `subscription_renewals` accepts the generated column set and is ready for later policy/index cleanup
- `refund_requests.status` is being aligned with live types via a guarded compatibility migration so `cancelled` stays valid for future workflow updates
- `orders` already carries the live-link fields needed by short-link and settlement flows: `sales_channel_id`, `payment_source_id`, `payment_terms`, `order_code`
- `orders.sales_channel_id`, `orders.customer_id`, `orders.product_id`, and `orders.payment_source_id` are all surfaced in the live relation graph
- `orders` exposes reverse embeds to `order_status_history`, `order_items`, `payments`, and `refund_requests`
- `payment_sources` exposes reverse embeds to `orders`, so payment-source history stays discoverable from either side
- `refund_requests.customer_id` still resolves to `customers.id`
- `order_items` already carries allocation metadata used by inventory flows: `assigned_source_account_id`, `customer_nick_used`
- `order_items` exposes direct embeds to `orders` and `products`, so the generated types should keep that relation graph explicit

### 5. Inventory and Source Accounts

Goal:
- stabilize allocation, product catalog, and provider relations

Tables:
- `products`
- `providers`
- `source_accounts`
- `license_keys`
- `purchase_orders`
- `provider_product_prices`

Confirmed live-vs-types notes:
- `providers`
  - live includes `contact_email`
  - live `notes` is text-shaped, not JSON-shaped
  - `contacts` remains a JSON array of contact objects
  - live API does not expose an `accounts` embed; it only surfaces `purchase_orders` and `provider_product_prices`
- `source_accounts`
  - live `notes` is JSON-shaped and already used to store nested credentials metadata
  - `product_ids` and `reserved_nicks` are array-shaped and match the generated model
- `products`
  - live shape matches the generated model
  - live API exposes reverse embeds to `orders`, `order_items`, `license_keys`, and `provider_product_prices`
- `order_items`
  - live API exposes direct embeds to `orders` and `products`
  - keep allocation metadata (`assigned_source_account_id`, `customer_nick_used`) intact
- `license_keys`
  - allocation flow is already defined in migration RPCs, including `assigned_at`
  - keep the table aligned with slot allocation and order assignment
  - live API exposes direct embeds to `products` and `orders`, but not `accounts`
- `purchase_orders`
  - live shape matches the generated model
  - `items` stores JSON line items, `notes` is text-shaped
  - live API confirms FKs to `accounts` and `providers`
- `provider_product_prices`
  - live API confirms FKs to `accounts`, `providers`, and `products`
- `providers`, `products`, `source_accounts`
  - live API does not expose an `accounts` FK relation for these three tables, so the graph stays intentionally app-level there

### 6. Settings and Bot Runtime

Goal:
- align reminder templates, activity logs, bot contacts, bot sessions, and error tracking with live truth
- keep runtime tables stable even when live API exposes only part of the relation graph

Tables:
- `reminder_config`
- `reminder_events`
- `reminder_logs`
- `activity_logs`
- `system_settings`
- `bot_user_contacts`
- `bot_sessions`
- `bot_error_logs`

Current status:
- `reminder_config` exposes an `accounts` relation in live API
- `reminder_logs` exposes `accounts`, `orders`, and `customers` relations in live API
- `activity_logs` exposes `accounts`, `customers`, `orders`, and `source_accounts` relations in live API
- `bot_user_contacts` exposes `accounts` and `customers` relations in live API
- `bot_sessions` exposes a `customers` relation in live API, but not `accounts`
- `bot_error_logs` exposes a `customers` relation in live API, but not `accounts`
- `reminder_events` and `system_settings` remain intentionally app-level/no-FK in live API

Guarded migration stance:
- do not add new FK guards for `source_accounts`, `reminder_events`, or `system_settings` at this stage
- keep `database.types.ts` aligned with the live relation graph first
- only add a guarded migration here if a future live probe reveals a relation we want to formalize

### 7. Premium Module

Goal:
- keep the premium domain isolated from core identity
- preserve the live schema as-is unless we have a concrete tenant/FK hardening step
- do not treat `premium_accounts` as the root tenant table

Tables:
- `premium_service_types`
- `premium_packages`
- `premium_accounts`
- `premium_account_users`
- `customer_premium_subscriptions`
- `premium_account_health_logs`
- `premium_account_user_history`
- `account_migrations`
- `account_migration_history`

Current status:
- live tables and generated types already agree on the premium catalog shape
- `account_id` is the tenant-scoping column on premium tables
- `customer_premium_subscriptions.status` and `renewal_status` remain intentionally loose until the workflow is finalized
- `customer_premium_subscriptions` exposes premium-side relations, but live API does not surface nested relations to `customers` or `orders`
- `account_migrations` exposes premium-side relations to subscription/source/target/user tables and the tenant `accounts` table, but not to `customers`
- `account_migration_history` exposes `account_id` and `migration_id` relations in live API

Migration order:
1. Run `20260314000000_rls_tenant_isolation.sql` if it has not already been applied.
2. Run `20260418170000_premium_account_fk_alignment.sql` to harden premium tenant ownership against `accounts(id)`.
3. Do not run legacy `0001_add_account_id_to_customers.sql` or `20260306173000_add_account_id_to_customers.sql` on a live DB; those files still point `account_id` at `premium_accounts`.
4. Keep `customer_premium_subscriptions.order_id` unconstrained for now unless we decide to formalize that workflow too.

## Migration Strategy

- Prefer `to_regclass(...)` before touching a table.
- Use `NOT VALID` for new FKs during backfill.
- Let live schema win over generated types when they disagree.
- Keep compatibility wrappers in the app layer until the schema settles.

## Verification Order

1. Compare live columns to `database.types.ts`.
2. Patch only the active domain.
3. Run typecheck, tests, build, and smoke for the touched flow.
4. Move to the next domain only after the previous one is stable.
