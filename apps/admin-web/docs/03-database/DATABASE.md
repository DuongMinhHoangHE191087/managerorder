# 🗄️ Database Schema — Premium Accounts Management System

**Engine:** PostgreSQL via Supabase  
**Auto-generated Types:** `src/lib/supabase/database.types.ts` (42KB)  
**Last Updated:** 2026-03-10

---

## Mục Lục

1. [Tables Overview](#1-tables-overview)
2. [Core Tables](#2-core-tables)
3. [Product & Inventory Tables](#3-product--inventory-tables)
4. [Premium Tables (Legacy)](#4-premium-tables-legacy)
5. [Settings & Events Tables](#5-settings--events-tables)
6. [PostgreSQL Functions](#6-postgresql-functions)
7. [Row Level Security (RLS)](#7-row-level-security-rls)
8. [Indexes](#8-indexes)
9. [Data Mappers](#9-data-mappers)
10. [Migrations](#10-migrations)

---

## 1. Tables Overview

| # | Table | Group | Key Columns |
|---|-------|-------|-------------|
| 1 | `accounts` | Core | id, name |
| 2 | `admin_users` | Core | id, email, role, account_id |
| 3 | `customers` | Core | id, full_name, type, contacts, nicks_registry, account_id |
| 4 | `customer_contacts` | Core | id, customer_id, channel, value, is_primary |
| 5 | `orders` | Core | id, customer_id, product_id, status, total_amount_vnd, total_paid, account_id |
| 6 | `order_items` | Core | id, order_id, product_id, quantity, price_vnd, assigned_source_account_id |
| 7 | `products` | Product | id, name, mode, sell_price_vnd, buy_price_vnd, duration_type, duration_value, account_id |
| 8 | `license_keys` | Inventory | id, key_code, product_id, status, order_id, account_id |
| 9 | `source_accounts` | Warehouse | id, email, provider, max_slots, used_slots, product_ids, notes, account_id |
| 10 | `order_source_links` | Warehouse | id, order_item_id, source_account_id |
| 11 | `providers` | Core | id, name, contacts, tier, reliability_score, account_id |
| 12 | `system_settings` | Settings | id, company_name, bank_name, bank_account, etc. |
| 13 | `payment_sources` | Settings | id, name, icon, account_id |
| 14 | `sales_channels` | Settings | id, name, account_id |
| 15 | `reminder_events` | Events | id, title, due_at, type, customer_ids, gcal_event_id, account_id |
| 16 | `calendar_notes` | Events | id, account_id, content |
| 17 | `activity_logs` | Audit | id, action_type, customer_id, order_id, details, created_at |
| 18 | `integrations` | System | id, account_id, provider, access_token, refresh_token |

### Premium (Legacy) Tables

| # | Table | Key Columns |
|---|-------|-------------|
| 19 | `premium_service_types` | id, name, max_slots |
| 20 | `premium_packages` | id, service_type_id, duration_days, price |
| 21 | `premium_accounts` | id, service_type_id, email, password_encrypted |
| 22 | `premium_account_users` | id, account_id, customer_id, slot_number |
| 23 | `customer_premium_subscriptions` | id, customer_id, premium_account_id |
| 24 | `premium_account_health_logs` | id, account_id, check_result |
| 25 | `premium_account_user_history` | id, account_user_id, action |
| 26 | `subscription_renewals` | id, subscription_id, renewal_date |
| 27 | `account_migrations` | id, from_account_id, to_account_id |
| 28 | `account_migration_history` | id, migration_id, step |

---

## 2. Core Tables

### `orders`

```sql
CREATE TABLE orders (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id     UUID NOT NULL REFERENCES accounts(id),
  customer_id    UUID REFERENCES customers(id),
  product_id     UUID REFERENCES products(id),          -- legacy single-product
  product_name_snapshot TEXT,                             -- frozen at creation
  quantity       INTEGER DEFAULT 1,
  unit_price_vnd NUMERIC,                                -- frozen price snapshot
  total_amount_vnd NUMERIC NOT NULL,                     -- frozen total
  cost_price_vnd NUMERIC,                                -- cost snapshot
  total_cost_vnd NUMERIC,                                -- total cost
  total_paid     NUMERIC DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'draft',           -- OrderStatus enum
  payment_method TEXT,                                    -- paid/debt/cod
  payment_source_id UUID REFERENCES payment_sources(id),
  sales_channel_id UUID REFERENCES sales_channels(id),
  contact_snapshot TEXT,
  sales_note     TEXT,
  proof_image_urls JSONB DEFAULT '[]',
  invoice_snapshot JSONB,                                 -- seller info frozen
  billing_details JSONB,                                  -- buyer info frozen
  expires_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);
```

**Status Flow:**
```
draft → pending_payment → paid → provisioning → active → expired
                                                       ↗
                              paid → refunded
```

### `order_items`

```sql
CREATE TABLE order_items (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                  UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id                UUID REFERENCES products(id),
  product_name_snapshot     TEXT,
  quantity                  INTEGER DEFAULT 1,
  price_vnd                 NUMERIC NOT NULL,
  subtotal_vnd              NUMERIC NOT NULL,
  cost_price_vnd            NUMERIC,
  notes                     TEXT,
  assigned_source_account_id UUID REFERENCES source_accounts(id),
  assigned_license_key_id   UUID REFERENCES license_keys(id),
  customer_nick_used        TEXT,
  created_at                TIMESTAMPTZ DEFAULT now()
);
```

### `customers`

```sql
CREATE TABLE customers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id     UUID NOT NULL,
  full_name      TEXT NOT NULL,
  type           TEXT DEFAULT 'retail',     -- retail/wholesale/agency
  notes          TEXT,
  nicks_registry JSONB DEFAULT '[]',        -- [{nick, type, notes, matched_source_id}]
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);
```

---

## 3. Product & Inventory Tables

### `products`

```sql
CREATE TABLE products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID NOT NULL,
  name            TEXT NOT NULL,
  mode            TEXT NOT NULL DEFAULT 'slot',  -- slot/key/hybrid
  sell_price_vnd  NUMERIC NOT NULL,
  buy_price_vnd   NUMERIC DEFAULT 0,
  duration_type   TEXT NOT NULL DEFAULT 'days',  -- days/months/years
  duration_value  INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
```

### `source_accounts`

```sql
CREATE TABLE source_accounts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID NOT NULL,
  email       TEXT NOT NULL,
  provider    TEXT NOT NULL,
  product_ids UUID[] DEFAULT '{}',
  max_slots   INTEGER DEFAULT 1,
  used_slots  INTEGER DEFAULT 0,
  notes       JSONB DEFAULT '{}',      -- dynamic credentials (2FA, links, etc.)
  reserved_nicks TEXT[] DEFAULT '{}',
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
```

### `license_keys`

```sql
CREATE TABLE license_keys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID NOT NULL,
  product_id  UUID REFERENCES products(id),
  key_code    TEXT NOT NULL,
  status      TEXT DEFAULT 'available',  -- available/used/revoked
  order_id    UUID REFERENCES orders(id),
  assigned_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
```

---

## 4. Premium Tables (Legacy)

> Thiết kế ban đầu cho hệ thống premium sharing. Vẫn hoạt động nhưng các tính năng mới nên dùng `source_accounts` + `order_items`.

Xem chi tiết trong `docs/03-database/` cho legacy schema.

---

## 5. Settings & Events Tables

### `reminder_events`

```sql
CREATE TABLE reminder_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    UUID NOT NULL,
  title         TEXT NOT NULL,
  due_at        TIMESTAMPTZ NOT NULL,
  type          TEXT DEFAULT 'follow_up',  -- renewal/follow_up/payment_due/other
  is_done       BOOLEAN DEFAULT false,
  customer_ids  UUID[] DEFAULT '{}',
  notes         TEXT,
  has_reminder  BOOLEAN DEFAULT false,
  gcal_event_id TEXT,                      -- Google Calendar sync ID
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
```

### `activity_logs`

```sql
CREATE TABLE activity_logs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type           TEXT NOT NULL,
  customer_id           UUID,
  order_id              UUID,
  inventory_account_id  UUID,
  details               JSONB DEFAULT '{}',
  created_at            TIMESTAMPTZ DEFAULT now()
);
```

---

## 6. PostgreSQL Functions

### `increment_source_account_slots(account_id, source_id, quantity)`
Atomically increment/decrement `used_slots` cho source account. Kiểm tra capacity trước khi cập nhật.

### `allocate_license_keys(account_id, product_id, order_id, quantity)`
Atomically allocate N license keys với `FOR UPDATE SKIP LOCKED`. Đảm bảo concurrency-safe.

---

## 7. Row Level Security (RLS)

RLS được bật cho các tables:
- `calendar_notes` — User chỉ đọc/ghi notes của account mình
- Các tables khác sử dụng `admin` service role key (bypass RLS)

---

## 8. Indexes

```sql
-- Orders
idx_orders_account_id         ON orders(account_id)
idx_orders_customer_id        ON orders(customer_id)
idx_orders_status             ON orders(status)
idx_orders_created_at         ON orders(created_at DESC)

-- Order Items
idx_order_items_order_id      ON order_items(order_id)
idx_order_items_product_id    ON order_items(product_id)

-- Customers (with trigram search)
idx_customers_account_id      ON customers(account_id)
idx_customers_full_name_trgm  ON customers USING gin(full_name gin_trgm_ops)

-- Products
idx_products_account_id       ON products(account_id)
idx_products_is_active        ON products(is_active)

-- Calendar
idx_reminder_events_account_id  ON reminder_events(account_id)
idx_reminder_events_due_at      ON reminder_events(due_at)

-- Integrations
integrations_account_provider_idx  ON integrations(account_id, provider) UNIQUE
```

**Extension:** `pg_trgm` — hỗ trợ fuzzy text search cho tên khách hàng.

---

## 9. Data Mappers

**File:** `src/lib/supabase/mappers.ts`

Chuyển đổi DB rows → Domain model objects:

| Mapper | DB Table → Domain Type |
|--------|----------------------|
| `mapProductRow()` | `products` → `ProductService` |
| `mapProviderRow()` | `providers` → `Provider` |
| `mapCalendarEventRow()` | `reminder_events` → `CalendarEvent` |

### Repository Layer

**File:** `src/lib/supabase/repositories/*.repo.ts`

| Repository | File | Tables |
|-----------|------|--------|
| `orders.repo` | `orders.repo.ts` | orders, order_items |
| `customers.repo` | `customers.repo.ts` | customers, customer_contacts |
| `products.repo` | `products.repo.ts` | products |
| `providers.repo` | `providers.repo.ts` | providers |
| `inventory.repo` | `inventory.repo.ts` | license_keys |
| `source-accounts.repo` | `source-accounts.repo.ts` | source_accounts, order_source_links |
| `calendar.repo` | `calendar.repo.ts` | reminder_events, calendar_notes |
| `activity-logs.repo` | `activity-logs.repo.ts` | activity_logs |
| `settings.repo` | `settings.repo.ts` | system_settings, payment_sources, sales_channels |
| `subscriptions.repo` | `subscriptions.repo.ts` | customer_premium_subscriptions (legacy) |

---

## 10. Migrations

**Thư mục:** `supabase/migrations/` — 14 migration files

Merged migrations file: `supabase/merged_migrations.sql`

| Migration | Description |
|-----------|-------------|
| Account IDs | Add account_id to customers & providers |
| Performance indexes | 10+ indexes for query optimization |
| pg_trgm extension | Fuzzy text search support |
| Integrations table | OAuth token storage for GCal |
| GCal sync | Add gcal_event_id to reminder_events |
| Calendar notes | New table for daily notes |
| Duration refactor | Replace duration_days with duration_type + duration_value |
| Cost pricing | Add cost_price_vnd to orders & order_items |
| Nick connections | Add customer_nick_used, nicks_registry |
| Slot functions | increment_source_account_slots() function |
| Key allocation | allocate_license_keys() function |
| Source notes | Add JSONB notes to source_accounts |

---

*Database Documentation — Antigravity — 2026-03-10*
