-- ============================================================================
-- Migration: Purchase orders tenant isolation RLS
-- Description: Enable row-level security for purchase_orders so authenticated
--              tenants can only access their own provider inbound orders.
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.purchase_orders') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "tenant_isolation" ON public.purchase_orders';
    EXECUTE 'CREATE POLICY "tenant_isolation" ON public.purchase_orders
      FOR ALL TO authenticated
      USING (account_id = public.get_user_account_id())
      WITH CHECK (account_id = public.get_user_account_id())';
  END IF;
END $$;
