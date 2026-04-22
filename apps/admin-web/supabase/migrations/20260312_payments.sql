-- Migration: Payments table for multi-payment tracking with proof images
-- Created: 2026-03-12

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  payment_method TEXT,             -- bank_transfer, cash, momo, etc.
  payment_source_id UUID,          -- FK to payment_sources settings
  proof_image_url TEXT,            -- URL to uploaded proof image
  note TEXT,                       -- payment note
  paid_by TEXT,                    -- who recorded the payment
  paid_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON public.payments(paid_at DESC);

COMMENT ON TABLE public.payments IS 'Individual payment records per order - supports partial/installment payments with proof images';
