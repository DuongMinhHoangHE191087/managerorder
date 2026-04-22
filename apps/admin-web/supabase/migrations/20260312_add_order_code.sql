-- Migration: add_order_code_column
-- Description: Thêm cột order_code dạng DMH_XXXXXX vào bảng orders

-- 1. Add column
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS order_code VARCHAR(50);

-- 2. Create unique compound index per account
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_account_order_code
ON public.orders (account_id, order_code)
WHERE order_code IS NOT NULL;

-- 3. Backfill existing orders with DMH_ + first 6 chars of UUID
UPDATE public.orders
SET order_code = 'DMH_' || UPPER(REPLACE(LEFT(id::text, 8), '-', ''))
WHERE order_code IS NULL;
