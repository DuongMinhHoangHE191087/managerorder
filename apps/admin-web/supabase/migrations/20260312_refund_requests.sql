-- Migration: Refund Requests table for refund flow management
-- Created: 2026-03-12
-- Flow: requested → approved → processing → completed / rejected

CREATE TABLE IF NOT EXISTS public.refund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id),
  
  -- Amounts
  paid_amount_vnd NUMERIC NOT NULL DEFAULT 0,
  consumed_days INT NOT NULL DEFAULT 0,
  total_days INT NOT NULL DEFAULT 0,
  refund_mode TEXT NOT NULL DEFAULT 'pro_rata' CHECK (refund_mode IN ('full', 'pro_rata')),
  refundable_amount_vnd NUMERIC NOT NULL DEFAULT 0,
  
  -- Status flow
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','processing','completed','rejected')),
  
  -- Metadata
  reason TEXT,
  admin_note TEXT,
  requested_by TEXT,
  approved_by TEXT,
  processed_by TEXT,
  
  -- Timestamps
  requested_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  approved_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_refund_requests_order_id ON public.refund_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_customer_id ON public.refund_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_status ON public.refund_requests(status);

COMMENT ON TABLE public.refund_requests IS 'Refund request tracking with approval chain: requested → approved → processing → completed/rejected';
