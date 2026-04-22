-- Migration: Order Status History table for audit trail (who/when/what)
-- Created: 2026-03-12

CREATE TABLE IF NOT EXISTS public.order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by TEXT,          -- admin user email or system identifier
  change_reason TEXT,       -- optional note for why status changed
  metadata JSONB DEFAULT '{}'::jsonb,  -- extra context (payment info, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id 
  ON public.order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_created_at 
  ON public.order_status_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_status_history_new_status 
  ON public.order_status_history(new_status);

-- Comment for documentation
COMMENT ON TABLE public.order_status_history IS 'Audit trail for order status transitions - who changed what and when';
