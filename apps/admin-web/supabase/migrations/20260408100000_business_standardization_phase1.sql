-- ============================================================================
-- Business standardization phase 1
-- Additive migration only: payment terms/state foundation, tenant i18n settings,
-- and purchase-order invariants.
-- Safe to run multiple times.
-- ============================================================================

-- ============================================================================
-- Orders: payment_terms + derived financial view
-- ============================================================================

ALTER TABLE IF EXISTS public.orders
  ADD COLUMN IF NOT EXISTS payment_terms text;

UPDATE public.orders
SET payment_terms = CASE lower(btrim(COALESCE(payment_method, '')))
  WHEN 'paid' THEN 'prepaid'
  WHEN 'debt' THEN 'credit'
  WHEN 'cod' THEN 'cod'
  WHEN 'prepaid' THEN 'prepaid'
  WHEN 'credit' THEN 'credit'
  ELSE payment_terms
END
WHERE payment_terms IS NULL
   OR btrim(COALESCE(payment_terms, '')) = '';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'orders'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_payment_terms_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_payment_terms_check
      CHECK (
        payment_terms IS NULL
        OR payment_terms IN ('prepaid', 'credit', 'cod')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_account_payment_terms
  ON public.orders(account_id, payment_terms)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW public.order_financials_v1 AS
SELECT
  o.id AS order_id,
  o.account_id,
  COALESCE(
    NULLIF(btrim(o.payment_terms), ''),
    CASE lower(btrim(COALESCE(o.payment_method, '')))
      WHEN 'paid' THEN 'prepaid'
      WHEN 'debt' THEN 'credit'
      WHEN 'cod' THEN 'cod'
      WHEN 'prepaid' THEN 'prepaid'
      WHEN 'credit' THEN 'credit'
      ELSE NULL
    END
  ) AS payment_terms,
  CASE
    WHEN COALESCE(o.total_paid, 0) <= 0 THEN 'unpaid'
    WHEN COALESCE(o.total_paid, 0) < COALESCE(o.total_amount_vnd, 0) THEN 'partial'
    WHEN COALESCE(o.total_paid, 0) = COALESCE(o.total_amount_vnd, 0) THEN 'paid'
    ELSE 'overpaid'
  END AS payment_state,
  GREATEST(COALESCE(o.total_amount_vnd, 0) - COALESCE(o.total_paid, 0), 0) AS balance_due_vnd,
  GREATEST(COALESCE(o.total_paid, 0) - COALESCE(o.total_amount_vnd, 0), 0) AS overpaid_amount_vnd,
  (COALESCE(o.total_paid, 0) >= COALESCE(o.total_amount_vnd, 0)) AS is_fully_paid,
  CASE
    WHEN GREATEST(COALESCE(o.total_amount_vnd, 0) - COALESCE(o.total_paid, 0), 0) > 0
      THEN GREATEST((CURRENT_DATE - DATE(COALESCE(o.created_at, now())))::integer, 0)
    ELSE 0
  END AS debt_age_days,
  o.status,
  o.total_amount_vnd,
  o.total_paid,
  o.created_at,
  o.updated_at
FROM public.orders o
WHERE o.deleted_at IS NULL;

-- ============================================================================
-- System settings: i18n + invoice/tax + payment instructions
-- ============================================================================

ALTER TABLE IF EXISTS public.system_settings
  ADD COLUMN IF NOT EXISTS default_currency text NOT NULL DEFAULT 'VND',
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'vi-VN',
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  ADD COLUMN IF NOT EXISTS invoice_prefix text NOT NULL DEFAULT 'INV',
  ADD COLUMN IF NOT EXISTS tax_label text NOT NULL DEFAULT 'VAT',
  ADD COLUMN IF NOT EXISTS tax_rate_default numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_instruction_template text NOT NULL DEFAULT '';

UPDATE public.system_settings
SET
  default_currency = COALESCE(NULLIF(btrim(COALESCE(default_currency, '')), ''), 'VND'),
  locale = COALESCE(NULLIF(btrim(COALESCE(locale, '')), ''), 'vi-VN'),
  timezone = COALESCE(NULLIF(btrim(COALESCE(timezone, '')), ''), 'Asia/Ho_Chi_Minh'),
  invoice_prefix = COALESCE(NULLIF(btrim(COALESCE(invoice_prefix, '')), ''), 'INV'),
  tax_label = COALESCE(NULLIF(btrim(COALESCE(tax_label, '')), ''), 'VAT'),
  tax_rate_default = COALESCE(tax_rate_default, 0),
  payment_instruction_template = COALESCE(payment_instruction_template, '')
WHERE default_currency IS NULL
   OR btrim(COALESCE(default_currency, '')) = ''
   OR locale IS NULL
   OR btrim(COALESCE(locale, '')) = ''
   OR timezone IS NULL
   OR btrim(COALESCE(timezone, '')) = ''
   OR invoice_prefix IS NULL
   OR btrim(COALESCE(invoice_prefix, '')) = ''
   OR tax_label IS NULL
   OR btrim(COALESCE(tax_label, '')) = ''
   OR tax_rate_default IS NULL
   OR payment_instruction_template IS NULL;

-- ============================================================================
-- Purchase orders: enforce financial invariants and normalize status
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'purchase_orders'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'purchase_orders_status_check'
  ) THEN
    ALTER TABLE public.purchase_orders
      ADD CONSTRAINT purchase_orders_status_check
      CHECK (status IN ('pending', 'partial', 'received', 'cancelled'));
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'purchase_orders'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'purchase_orders_amounts_nonnegative_check'
  ) THEN
    ALTER TABLE public.purchase_orders
      ADD CONSTRAINT purchase_orders_amounts_nonnegative_check
      CHECK (total_amount_vnd >= 0 AND total_paid_vnd >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'purchase_orders'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'purchase_orders_paid_le_total_check'
  ) THEN
    ALTER TABLE public.purchase_orders
      ADD CONSTRAINT purchase_orders_paid_le_total_check
      CHECK (total_paid_vnd <= total_amount_vnd);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.normalize_purchase_order_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.total_amount_vnd := COALESCE(NEW.total_amount_vnd, 0);
  NEW.total_paid_vnd := COALESCE(NEW.total_paid_vnd, 0);
  NEW.items := COALESCE(NEW.items, '[]'::jsonb);
  NEW.updated_at := COALESCE(NEW.updated_at, now());

  IF NEW.total_amount_vnd < 0 OR NEW.total_paid_vnd < 0 THEN
    RAISE EXCEPTION 'purchase_order_amounts_must_be_nonnegative';
  END IF;

  IF NEW.total_paid_vnd > NEW.total_amount_vnd THEN
    RAISE EXCEPTION 'purchase_order_total_paid_exceeds_total_amount';
  END IF;

  IF lower(btrim(COALESCE(NEW.status, ''))) = 'cancelled' THEN
    RETURN NEW;
  END IF;

  IF NEW.received_at IS NOT NULL THEN
    IF NEW.total_paid_vnd < NEW.total_amount_vnd THEN
      RAISE EXCEPTION 'purchase_order_received_requires_full_payment';
    END IF;
    NEW.status := 'received';
    RETURN NEW;
  END IF;

  IF NEW.total_paid_vnd <= 0 THEN
    NEW.status := 'pending';
  ELSE
    NEW.status := 'partial';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_purchase_orders_normalize_write ON public.purchase_orders;
CREATE TRIGGER trg_purchase_orders_normalize_write
BEFORE INSERT OR UPDATE ON public.purchase_orders
FOR EACH ROW
EXECUTE FUNCTION public.normalize_purchase_order_write();
