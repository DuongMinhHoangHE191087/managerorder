-- Tenant isolation for auxiliary tables that were missing explicit RLS policies.
-- provider_product_prices and webhook tables are account-scoped and should not
-- rely on client-side filters alone.

DO $$
BEGIN
  IF to_regclass('public.provider_product_prices') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.provider_product_prices ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "tenant_isolation" ON public.provider_product_prices';
    EXECUTE 'CREATE POLICY "tenant_isolation" ON public.provider_product_prices
      FOR ALL TO authenticated
      USING (account_id = public.get_user_account_id())
      WITH CHECK (account_id = public.get_user_account_id())';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.webhook_endpoints') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "tenant_isolation" ON public.webhook_endpoints';
    EXECUTE 'CREATE POLICY "tenant_isolation" ON public.webhook_endpoints
      FOR ALL TO authenticated
      USING (account_id = public.get_user_account_id())
      WITH CHECK (account_id = public.get_user_account_id())';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.webhook_events') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "tenant_isolation" ON public.webhook_events';
    EXECUTE 'CREATE POLICY "tenant_isolation" ON public.webhook_events
      FOR ALL TO authenticated
      USING (account_id = public.get_user_account_id())
      WITH CHECK (account_id = public.get_user_account_id())';
  END IF;
END $$;
