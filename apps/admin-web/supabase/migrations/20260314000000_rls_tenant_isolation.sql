-- ============================================================================
-- Migration: RLS Tenant Isolation Policies
-- Description: Replace insecure "full_access" policies with proper 
--              multi-tenant isolation using account_id.
-- Strategy: Defense-in-depth. Server uses service_role (bypasses RLS),
--           but policies protect against anon/authenticated access.
-- ============================================================================

-- ============================================================================
-- STEP 1: Helper Function - Get current user's account_id from admin_users
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_user_account_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id UUID;
BEGIN
  IF to_regclass('public.admin_users') IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT account_id
    INTO v_account_id
  FROM public.admin_users
  WHERE id = auth.uid()
  LIMIT 1;

  RETURN v_account_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_account_id() TO authenticated;

-- ============================================================================
-- STEP 2: Drop ALL insecure "full_access" policies (qual = true, role = public)
-- ============================================================================
DROP POLICY IF EXISTS "full_access" ON public.customers;
DROP POLICY IF EXISTS "full_access" ON public.orders;
DROP POLICY IF EXISTS "full_access" ON public.order_items;
DROP POLICY IF EXISTS "full_access" ON public.source_accounts;
DROP POLICY IF EXISTS "full_access" ON public.products;
DROP POLICY IF EXISTS "full_access" ON public.providers;
DROP POLICY IF EXISTS "full_access" ON public.license_keys;
DROP POLICY IF EXISTS "full_access" ON public.payment_sources;
DROP POLICY IF EXISTS "full_access" ON public.reminder_events;
DROP POLICY IF EXISTS "full_access" ON public.sales_channels;
DROP POLICY IF EXISTS "full_access" ON public.system_settings;
DROP POLICY IF EXISTS "full_access" ON public.customer_contacts;
DROP POLICY IF EXISTS "full_access" ON public.customer_tags;
DROP POLICY IF EXISTS "full_access" ON public.customer_tag_assignments;

-- ============================================================================
-- STEP 3: Create Tenant-Isolation Policies
-- Pattern: Authenticated users can only access rows matching their account_id
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 3A. Tables WITH account_id column (direct tenant isolation)
-- ---------------------------------------------------------------------------

-- admin_users: keep existing service_role policy, add authenticated policy
DO $$
BEGIN
  IF to_regclass('public.admin_users') IS NOT NULL THEN
    EXECUTE 'CREATE POLICY "tenant_isolation_select" ON public.admin_users
      FOR SELECT TO authenticated
      USING (account_id = public.get_user_account_id())';

    EXECUTE 'CREATE POLICY "tenant_isolation_all" ON public.admin_users
      FOR ALL TO authenticated
      USING (account_id = public.get_user_account_id())
      WITH CHECK (account_id = public.get_user_account_id())';
  END IF;
END $$;

-- customers
CREATE POLICY "tenant_isolation" ON public.customers
  FOR ALL TO authenticated
  USING (account_id = public.get_user_account_id())
  WITH CHECK (account_id = public.get_user_account_id());

-- orders
CREATE POLICY "tenant_isolation" ON public.orders
  FOR ALL TO authenticated
  USING (account_id = public.get_user_account_id())
  WITH CHECK (account_id = public.get_user_account_id());

-- products
CREATE POLICY "tenant_isolation" ON public.products
  FOR ALL TO authenticated
  USING (account_id = public.get_user_account_id())
  WITH CHECK (account_id = public.get_user_account_id());

-- source_accounts
CREATE POLICY "tenant_isolation" ON public.source_accounts
  FOR ALL TO authenticated
  USING (account_id = public.get_user_account_id())
  WITH CHECK (account_id = public.get_user_account_id());

-- providers
CREATE POLICY "tenant_isolation" ON public.providers
  FOR ALL TO authenticated
  USING (account_id = public.get_user_account_id())
  WITH CHECK (account_id = public.get_user_account_id());

-- license_keys
CREATE POLICY "tenant_isolation" ON public.license_keys
  FOR ALL TO authenticated
  USING (account_id = public.get_user_account_id())
  WITH CHECK (account_id = public.get_user_account_id());

-- payment_sources
CREATE POLICY "tenant_isolation" ON public.payment_sources
  FOR ALL TO authenticated
  USING (account_id = public.get_user_account_id())
  WITH CHECK (account_id = public.get_user_account_id());

-- premium_accounts
CREATE POLICY "tenant_isolation" ON public.premium_accounts
  FOR ALL TO authenticated
  USING (account_id = public.get_user_account_id())
  WITH CHECK (account_id = public.get_user_account_id());

-- premium_account_users
CREATE POLICY "tenant_isolation" ON public.premium_account_users
  FOR ALL TO authenticated
  USING (account_id = public.get_user_account_id())
  WITH CHECK (account_id = public.get_user_account_id());

-- premium_service_types
CREATE POLICY "tenant_isolation" ON public.premium_service_types
  FOR ALL TO authenticated
  USING (account_id = public.get_user_account_id())
  WITH CHECK (account_id = public.get_user_account_id());

-- premium_packages
CREATE POLICY "tenant_isolation" ON public.premium_packages
  FOR ALL TO authenticated
  USING (account_id = public.get_user_account_id())
  WITH CHECK (account_id = public.get_user_account_id());

-- customer_premium_subscriptions
CREATE POLICY "tenant_isolation" ON public.customer_premium_subscriptions
  FOR ALL TO authenticated
  USING (account_id = public.get_user_account_id())
  WITH CHECK (account_id = public.get_user_account_id());

-- premium_account_health_logs
CREATE POLICY "tenant_isolation" ON public.premium_account_health_logs
  FOR ALL TO authenticated
  USING (account_id = public.get_user_account_id())
  WITH CHECK (account_id = public.get_user_account_id());

-- premium_account_user_history
CREATE POLICY "tenant_isolation" ON public.premium_account_user_history
  FOR ALL TO authenticated
  USING (account_id = public.get_user_account_id())
  WITH CHECK (account_id = public.get_user_account_id());

-- account_migrations
CREATE POLICY "tenant_isolation" ON public.account_migrations
  FOR ALL TO authenticated
  USING (account_id = public.get_user_account_id())
  WITH CHECK (account_id = public.get_user_account_id());

-- account_migration_history
CREATE POLICY "tenant_isolation" ON public.account_migration_history
  FOR ALL TO authenticated
  USING (account_id = public.get_user_account_id())
  WITH CHECK (account_id = public.get_user_account_id());

-- subscription_renewals
CREATE POLICY "tenant_isolation" ON public.subscription_renewals
  FOR ALL TO authenticated
  USING (account_id = public.get_user_account_id())
  WITH CHECK (account_id = public.get_user_account_id());

-- reminder_events
CREATE POLICY "tenant_isolation" ON public.reminder_events
  FOR ALL TO authenticated
  USING (account_id = public.get_user_account_id())
  WITH CHECK (account_id = public.get_user_account_id());

-- sales_channels
CREATE POLICY "tenant_isolation" ON public.sales_channels
  FOR ALL TO authenticated
  USING (account_id = public.get_user_account_id())
  WITH CHECK (account_id = public.get_user_account_id());

-- system_settings
CREATE POLICY "tenant_isolation" ON public.system_settings
  FOR ALL TO authenticated
  USING (account_id = public.get_user_account_id())
  WITH CHECK (account_id = public.get_user_account_id());

-- activity_logs
CREATE POLICY "tenant_isolation" ON public.activity_logs
  FOR ALL TO authenticated
  USING (account_id = public.get_user_account_id())
  WITH CHECK (account_id = public.get_user_account_id());

-- customer_groups
CREATE POLICY "tenant_isolation" ON public.customer_groups
  FOR ALL TO authenticated
  USING (account_id = public.get_user_account_id())
  WITH CHECK (account_id = public.get_user_account_id());

-- customer_tags
CREATE POLICY "tenant_isolation" ON public.customer_tags
  FOR ALL TO authenticated
  USING (account_id = public.get_user_account_id())
  WITH CHECK (account_id = public.get_user_account_id());

-- users (Supabase-managed user accounts with account_id)
CREATE POLICY "tenant_isolation" ON public.users
  FOR ALL TO authenticated
  USING (account_id = public.get_user_account_id())
  WITH CHECK (account_id = public.get_user_account_id());

-- integrations (note: account_id is TEXT, not UUID, use cast)
CREATE POLICY "tenant_isolation" ON public.integrations
  FOR ALL TO authenticated
  USING (account_id = public.get_user_account_id()::text)
  WITH CHECK (account_id = public.get_user_account_id()::text);

-- ---------------------------------------------------------------------------
-- 3B. Tables WITHOUT account_id (use JOIN to parent table)
-- ---------------------------------------------------------------------------

-- accounts (the account table itself - users can only see their own account)
DO $$
BEGIN
  IF to_regclass('public.accounts') IS NOT NULL THEN
    EXECUTE 'CREATE POLICY "tenant_isolation" ON public.accounts
      FOR ALL TO authenticated
      USING (id = public.get_user_account_id())
      WITH CHECK (id = public.get_user_account_id())';
  END IF;
END $$;

-- customer_contacts (inherits via customers.account_id)
CREATE POLICY "tenant_isolation" ON public.customer_contacts
  FOR ALL TO authenticated
  USING (
    customer_id IN (
      SELECT id FROM public.customers 
      WHERE account_id = public.get_user_account_id()
    )
  )
  WITH CHECK (
    customer_id IN (
      SELECT id FROM public.customers 
      WHERE account_id = public.get_user_account_id()
    )
  );

-- customer_tag_assignments (inherits via customer_tags.account_id)
DROP POLICY IF EXISTS "full_access" ON public.customer_tag_assignments;
CREATE POLICY "tenant_isolation" ON public.customer_tag_assignments
  FOR ALL TO authenticated
  USING (
    tag_id IN (
      SELECT id FROM public.customer_tags 
      WHERE account_id = public.get_user_account_id()
    )
  )
  WITH CHECK (
    tag_id IN (
      SELECT id FROM public.customer_tags 
      WHERE account_id = public.get_user_account_id()
    )
  );

-- order_items (inherits via orders.account_id)
CREATE POLICY "tenant_isolation" ON public.order_items
  FOR ALL TO authenticated
  USING (
    order_id IN (
      SELECT id FROM public.orders 
      WHERE account_id = public.get_user_account_id()
    )
  )
  WITH CHECK (
    order_id IN (
      SELECT id FROM public.orders 
      WHERE account_id = public.get_user_account_id()
    )
  );

-- order_status_history (inherits via orders.account_id)
CREATE POLICY "tenant_isolation" ON public.order_status_history
  FOR ALL TO authenticated
  USING (
    order_id IN (
      SELECT id FROM public.orders 
      WHERE account_id = public.get_user_account_id()
    )
  )
  WITH CHECK (
    order_id IN (
      SELECT id FROM public.orders 
      WHERE account_id = public.get_user_account_id()
    )
  );

-- payments (inherits via orders.account_id)
CREATE POLICY "tenant_isolation" ON public.payments
  FOR ALL TO authenticated
  USING (
    order_id IN (
      SELECT id FROM public.orders 
      WHERE account_id = public.get_user_account_id()
    )
  )
  WITH CHECK (
    order_id IN (
      SELECT id FROM public.orders 
      WHERE account_id = public.get_user_account_id()
    )
  );

-- refund_requests (inherits via orders.account_id)
CREATE POLICY "tenant_isolation" ON public.refund_requests
  FOR ALL TO authenticated
  USING (
    order_id IN (
      SELECT id FROM public.orders 
      WHERE account_id = public.get_user_account_id()
    )
  )
  WITH CHECK (
    order_id IN (
      SELECT id FROM public.orders 
      WHERE account_id = public.get_user_account_id()
    )
  );

-- inventory_accounts (legacy table, no account_id - service_role only)
-- RLS is already enabled; no policy = only service_role can access
-- This is intentional as inventory_accounts is managed server-side only

-- ---------------------------------------------------------------------------
-- 3C. Update existing calendar_notes policies to use the helper function
--     (currently uses inline subquery, standardize to use get_user_account_id)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read own calendar notes" ON public.calendar_notes;
DROP POLICY IF EXISTS "Users can upsert own calendar notes" ON public.calendar_notes;

CREATE POLICY "tenant_isolation" ON public.calendar_notes
  FOR ALL TO authenticated
  USING (account_id = public.get_user_account_id())
  WITH CHECK (account_id = public.get_user_account_id());

-- ============================================================================
-- STEP 4: Performance optimization - ensure account_id indexes exist
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_admin_users_account_id ON public.admin_users(account_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_account_id ON public.activity_logs(account_id);
CREATE INDEX IF NOT EXISTS idx_calendar_notes_account_id ON public.calendar_notes(account_id);
CREATE INDEX IF NOT EXISTS idx_customer_groups_account_id ON public.customer_groups(account_id);
CREATE INDEX IF NOT EXISTS idx_customer_tags_account_id ON public.customer_tags(account_id);
CREATE INDEX IF NOT EXISTS idx_customer_premium_subs_account_id ON public.customer_premium_subscriptions(account_id);
CREATE INDEX IF NOT EXISTS idx_integrations_account_id ON public.integrations(account_id);
CREATE INDEX IF NOT EXISTS idx_license_keys_account_id ON public.license_keys(account_id);
CREATE INDEX IF NOT EXISTS idx_payment_sources_account_id ON public.payment_sources(account_id);
CREATE INDEX IF NOT EXISTS idx_premium_accounts_account_id ON public.premium_accounts(account_id);
CREATE INDEX IF NOT EXISTS idx_premium_account_users_account_id ON public.premium_account_users(account_id);
CREATE INDEX IF NOT EXISTS idx_premium_service_types_account_id ON public.premium_service_types(account_id);
CREATE INDEX IF NOT EXISTS idx_premium_packages_account_id ON public.premium_packages(account_id);
CREATE INDEX IF NOT EXISTS idx_premium_health_logs_account_id ON public.premium_account_health_logs(account_id);
CREATE INDEX IF NOT EXISTS idx_premium_user_history_account_id ON public.premium_account_user_history(account_id);
CREATE INDEX IF NOT EXISTS idx_account_migrations_account_id ON public.account_migrations(account_id);
CREATE INDEX IF NOT EXISTS idx_account_migration_history_account_id ON public.account_migration_history(account_id);
CREATE INDEX IF NOT EXISTS idx_subscription_renewals_account_id ON public.subscription_renewals(account_id);
CREATE INDEX IF NOT EXISTS idx_reminder_events_account_id_v2 ON public.reminder_events(account_id);
CREATE INDEX IF NOT EXISTS idx_sales_channels_account_id ON public.sales_channels(account_id);
CREATE INDEX IF NOT EXISTS idx_system_settings_account_id ON public.system_settings(account_id);
CREATE INDEX IF NOT EXISTS idx_users_account_id ON public.users(account_id);
CREATE INDEX IF NOT EXISTS idx_providers_account_id ON public.providers(account_id);
CREATE INDEX IF NOT EXISTS idx_source_accounts_account_id ON public.source_accounts(account_id);

-- ============================================================================
-- DONE: All tables now have proper tenant-isolation RLS policies.
-- service_role (used by API server) automatically bypasses all policies.
-- ============================================================================
