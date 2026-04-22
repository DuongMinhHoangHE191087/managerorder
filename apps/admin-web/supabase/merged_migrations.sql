ALTER TABLE IF EXISTS public.customers ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.premium_accounts(id);
ALTER TABLE IF EXISTS public.providers ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.premium_accounts(id);
NOTIFY pgrst, reload schema;
ALTER TABLE IF EXISTS public.customers ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.premium_accounts(id); ALTER TABLE IF EXISTS public.providers ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.premium_accounts(id); NOTIFY pgrst, reload schema;
-- Tối ưu hóa hiệu suất truy vấn cho các bảng chính
-- Tập trung vào các trường thường xuyên được sử dụng trong WHERE clause và JOIN

-- Kích hoạt extension hỗ trợ tìm kiếm text nâng cao (trigram)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Bảng Orders (Đơn hàng)
CREATE INDEX IF NOT EXISTS idx_orders_account_id ON orders(account_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- 2. Bảng Order Items (Chi tiết đơn hàng)
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- 3. Bảng Customers (Khách hàng)
CREATE INDEX IF NOT EXISTS idx_customers_account_id ON customers(account_id);
CREATE INDEX IF NOT EXISTS idx_customers_full_name_trgm ON customers USING gin (full_name gin_trgm_ops); -- Yêu cầu extension pg_trgm

-- 4. Bảng Products (Sản phẩm)
CREATE INDEX IF NOT EXISTS idx_products_account_id ON products(account_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);

-- 5. Bảng Calendar Events (Lịch nhắc nhở)
CREATE INDEX IF NOT EXISTS idx_reminder_events_account_id ON reminder_events(account_id);
CREATE INDEX IF NOT EXISTS idx_reminder_events_due_at ON reminder_events(due_at);
-- Create integrations table for OAuth tokens
CREATE TABLE IF NOT EXISTS public.integrations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id text NOT NULL, -- or uuid if matches your account_id type
  provider text NOT NULL,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add unique constraint for account and provider
CREATE UNIQUE INDEX IF NOT EXISTS integrations_account_provider_idx ON public.integrations(account_id, provider);

-- Add gcal_event_id to reminder_events
ALTER TABLE public.reminder_events
ADD COLUMN IF NOT EXISTS gcal_event_id text;
-- Up
CREATE TABLE IF NOT EXISTS public.calendar_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL,
    content TEXT DEFAULT '',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(account_id)
);

-- RLS
ALTER TABLE public.calendar_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own calendar notes"
    ON public.calendar_notes FOR SELECT
    USING (account_id IN (
        SELECT account_id FROM admin_users WHERE id = auth.uid()
    ));

CREATE POLICY "Users can upsert own calendar notes"
    ON public.calendar_notes FOR ALL
    USING (account_id IN (
        SELECT account_id FROM admin_users WHERE id = auth.uid()
    ));
-- Migration: Add duration setup and cost snapshot pricing 

-- 1. PRODUCTS TABLE
ALTER TABLE "public"."products" 
ADD COLUMN "duration_type" text NOT NULL DEFAULT 'days' CHECK ("duration_type" IN ('days', 'months', 'years')),
ADD COLUMN "duration_value" integer NOT NULL DEFAULT 0;

-- Convert existing duration_days
UPDATE "public"."products"
SET "duration_value" = "duration_days",
    "duration_type" = 'days'
WHERE "duration_days" IS NOT NULL;

-- Smart convert known durations
UPDATE "public"."products" SET "duration_value" = 6, "duration_type" = 'months' WHERE "duration_days" IN (180, 182, 183);
UPDATE "public"."products" SET "duration_value" = 1, "duration_type" = 'years' WHERE "duration_days" IN (365, 366);
UPDATE "public"."products" SET "duration_value" = 3, "duration_type" = 'months' WHERE "duration_days" = 90;
UPDATE "public"."products" SET "duration_value" = 1, "duration_type" = 'months' WHERE "duration_days" = 30;

-- Drop duration_days
ALTER TABLE "public"."products" DROP COLUMN "duration_days";


-- 2. ORDERS & ORDER ITEMS TABLES
ALTER TABLE "public"."order_items"
ADD COLUMN "cost_price_vnd" numeric;

ALTER TABLE "public"."orders"
ADD COLUMN "cost_price_vnd" numeric,
ADD COLUMN "total_cost_vnd" numeric;

-- Backfill data based on current buy_price_vnd from products
UPDATE "public"."order_items" oi
SET "cost_price_vnd" = p.buy_price_vnd
FROM "public"."products" p
WHERE oi.product_id = p.id;

UPDATE "public"."orders" o
SET "cost_price_vnd" = p.buy_price_vnd,
    "total_cost_vnd" = p.buy_price_vnd * o.quantity
FROM "public"."products" p
WHERE o.product_id = p.id AND o.product_id IS NOT NULL;
-- Migration: Add inventory nick connections support
-- Created: 2026-03-08 00:00:00

-- 1. Add customer_nick_used to order_items
ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS customer_nick_used text;

-- 2. Add nicks_registry to customers
-- Format: [{ "nick": "username/email/phone", "type": "e.g netflix, spotify", "notes": "...", "matched_source_id": "uuid or null" }]
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS nicks_registry jsonb DEFAULT '[]'::jsonb;
-- Atomically increment or decrement used_slots for a source account
-- Checks for capacity to prevent over-allocation.
CREATE OR REPLACE FUNCTION increment_source_account_slots(
  p_account_id UUID,
  p_source_id UUID,
  p_quantity INT
) RETURNS JSONB AS $$
DECLARE
  v_used INT;
  v_max INT;
BEGIN
  -- Lock the row for update
  SELECT used_slots, max_slots 
  INTO v_used, v_max 
  FROM source_accounts 
  WHERE id = p_source_id AND account_id = p_account_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source account not found';
  END IF;

  IF v_used + p_quantity > v_max THEN
    RAISE EXCEPTION 'Not enough slots available in this source account';
  END IF;

  IF v_used + p_quantity < 0 THEN
    RAISE EXCEPTION 'Cannot reduce used slots below 0';
  END IF;

  UPDATE source_accounts
  SET used_slots = used_slots + p_quantity,
      updated_at = NOW()
  WHERE id = p_source_id;

  RETURN jsonb_build_object(
    'success', true, 
    'source_id', p_source_id,
    'new_used_slots', v_used + p_quantity
  );
END;
$$ LANGUAGE plpgsql;

-- Atomically allocate N available license keys to an order
CREATE OR REPLACE FUNCTION allocate_license_keys(
  p_account_id UUID,
  p_product_id UUID,
  p_order_id UUID,
  p_quantity INT
) RETURNS JSONB AS $$
DECLARE
  v_allocated_count INT;
  v_allocated_ids UUID[];
BEGIN
  -- Attempt to lock and update the required number of available keys
  WITH locked_keys AS (
    SELECT id
    FROM license_keys
    WHERE account_id = p_account_id
      AND product_id = p_product_id
      AND status = 'available'
    ORDER BY created_at ASC
    LIMIT p_quantity
    FOR UPDATE SKIP LOCKED
  ),
  updated_keys AS (
    UPDATE license_keys
    SET status = 'used',
        order_id = p_order_id,
        assigned_at = NOW(),
        updated_at = NOW()
    FROM locked_keys
    WHERE license_keys.id = locked_keys.id
    RETURNING license_keys.id
  )
  SELECT count(*), array_agg(id) 
  INTO v_allocated_count, v_allocated_ids
  FROM updated_keys;

  IF v_allocated_count < p_quantity THEN
    RAISE EXCEPTION 'Not enough available license keys (requested %, found %)', p_quantity, v_allocated_count;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'allocated_count', v_allocated_count,
    'allocated_ids', v_allocated_ids
  );
END;
$$ LANGUAGE plpgsql;

-- Migration to add 'notes' column to source_accounts table for storing dynamic credentials (2FA, etc.)

ALTER TABLE public.source_accounts 
ADD COLUMN IF NOT EXISTS notes JSONB DEFAULT '{}'::jsonb;
