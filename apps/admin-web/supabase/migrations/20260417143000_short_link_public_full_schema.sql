-- ============================================================
-- Migration: short-link public full schema
-- Created: 2026-04-17
-- Purpose: one-shot, idempotent superset for
--   - sales_channels
--   - orders.sales_channel_id
--   - short_links delivery/channel fields
--   - short_link_clicks event_type
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------
-- sales_channels
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sales_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  name TEXT NOT NULL,
  default_delivery_mode TEXT NOT NULL DEFAULT 'direct_redirect'
    CHECK (default_delivery_mode IN ('direct_redirect', 'landing_page')),
  default_landing_template_key TEXT NOT NULL DEFAULT 'owner_intro'
    CHECK (default_landing_template_key IN ('owner_intro', 'ctv_neutral')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.sales_channels
  ADD COLUMN IF NOT EXISTS default_delivery_mode TEXT NOT NULL DEFAULT 'direct_redirect'
    CHECK (default_delivery_mode IN ('direct_redirect', 'landing_page')),
  ADD COLUMN IF NOT EXISTS default_landing_template_key TEXT NOT NULL DEFAULT 'owner_intro'
    CHECK (default_landing_template_key IN ('owner_intro', 'ctv_neutral'));

ALTER TABLE public.sales_channels
  ALTER COLUMN default_delivery_mode SET DEFAULT 'direct_redirect',
  ALTER COLUMN default_landing_template_key SET DEFAULT 'owner_intro';

UPDATE public.sales_channels
SET default_delivery_mode = 'direct_redirect'
WHERE default_delivery_mode IS NULL;

UPDATE public.sales_channels
SET default_landing_template_key = 'owner_intro'
WHERE default_landing_template_key IS NULL;

ALTER TABLE public.sales_channels
  ALTER COLUMN default_delivery_mode SET NOT NULL,
  ALTER COLUMN default_landing_template_key SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_channels_account_id
  ON public.sales_channels(account_id);

DO $$
BEGIN
  IF to_regclass('public.sales_channels') IS NOT NULL
    AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class rel ON rel.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = rel.relnamespace
    WHERE n.nspname = 'public'
      AND rel.relname = 'sales_channels'
      AND c.conname = 'sales_channels_account_id_fkey'
  ) THEN
    ALTER TABLE public.sales_channels
      ADD CONSTRAINT sales_channels_account_id_fkey
      FOREIGN KEY (account_id) REFERENCES public.accounts(id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;

ALTER TABLE public.sales_channels ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_user_account_id'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "tenant_isolation" ON public.sales_channels';
    EXECUTE 'CREATE POLICY "tenant_isolation" ON public.sales_channels
      FOR ALL TO authenticated
      USING (account_id = public.get_user_account_id())
      WITH CHECK (account_id = public.get_user_account_id())';
  END IF;
END $$;

-- ------------------------------------------------------------
-- orders -> sales_channels
-- ------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.orders') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS sales_channel_id UUID';
    EXECUTE 'ALTER TABLE public.orders ALTER COLUMN sales_channel_id DROP NOT NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_orders_sales_channel_id ON public.orders(sales_channel_id)';

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class rel ON rel.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = rel.relnamespace
      WHERE n.nspname = 'public'
        AND rel.relname = 'orders'
        AND c.conname = 'orders_sales_channel_id_fkey'
    ) THEN
      EXECUTE 'ALTER TABLE public.orders
        ADD CONSTRAINT orders_sales_channel_id_fkey
        FOREIGN KEY (sales_channel_id) REFERENCES public.sales_channels(id)
        ON DELETE SET NULL
        NOT VALID';
    END IF;
  END IF;
END $$;

-- ------------------------------------------------------------
-- short_links
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.short_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  target_url TEXT NOT NULL,
  title TEXT,
  max_clicks INT NOT NULL DEFAULT 1,
  current_clicks INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'disabled')),
  order_id UUID,
  customer_id UUID,
  created_by TEXT,
  access_token TEXT,
  locked_ip TEXT,
  locked_ipv6 INET,
  require_token BOOLEAN NOT NULL DEFAULT FALSE,
  notify_clicks BOOLEAN NOT NULL DEFAULT FALSE,
  sales_channel_id UUID REFERENCES public.sales_channels(id) ON DELETE SET NULL,
  delivery_mode TEXT NOT NULL DEFAULT 'inherit_channel'
    CHECK (delivery_mode IN ('inherit_channel', 'direct_redirect', 'landing_page')),
  landing_template_key TEXT
    CHECK (landing_template_key IN ('owner_intro', 'ctv_neutral')),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.short_links
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS access_token TEXT,
  ADD COLUMN IF NOT EXISTS locked_ip TEXT,
  ADD COLUMN IF NOT EXISTS locked_ipv6 INET,
  ADD COLUMN IF NOT EXISTS require_token BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS notify_clicks BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sales_channel_id UUID,
  ADD COLUMN IF NOT EXISTS delivery_mode TEXT NOT NULL DEFAULT 'inherit_channel'
    CHECK (delivery_mode IN ('inherit_channel', 'direct_redirect', 'landing_page')),
  ADD COLUMN IF NOT EXISTS landing_template_key TEXT
    CHECK (landing_template_key IN ('owner_intro', 'ctv_neutral'));

ALTER TABLE public.short_links
  ALTER COLUMN delivery_mode SET DEFAULT 'inherit_channel';

ALTER TABLE public.short_links
  ALTER COLUMN sales_channel_id DROP NOT NULL,
  ALTER COLUMN customer_id DROP NOT NULL;

UPDATE public.short_links
SET delivery_mode = 'direct_redirect'
WHERE delivery_mode IS NULL;

DO $$
BEGIN
  IF to_regclass('public.orders') IS NOT NULL THEN
    EXECUTE $q$
      UPDATE public.short_links sl
      SET sales_channel_id = o.sales_channel_id
      FROM public.orders o
      WHERE sl.order_id = o.id
        AND sl.sales_channel_id IS NULL
        AND o.sales_channel_id IS NOT NULL
    $q$;
  END IF;
END $$;

DO $$
BEGIN
  -- customer_id is intentionally left unconstrained because live customer IDs
  -- do not match the older generated type shape across all environments.
END $$;

CREATE INDEX IF NOT EXISTS idx_short_links_slug
  ON public.short_links(slug);
CREATE INDEX IF NOT EXISTS idx_short_links_account_id
  ON public.short_links(account_id);
CREATE INDEX IF NOT EXISTS idx_short_links_status
  ON public.short_links(status);
CREATE INDEX IF NOT EXISTS idx_short_links_deleted_at
  ON public.short_links(deleted_at);
CREATE INDEX IF NOT EXISTS idx_short_links_sales_channel_id
  ON public.short_links(sales_channel_id);
CREATE INDEX IF NOT EXISTS idx_short_links_delivery_mode
  ON public.short_links(delivery_mode);
CREATE INDEX IF NOT EXISTS idx_short_links_access_token
  ON public.short_links(access_token)
  WHERE access_token IS NOT NULL;

ALTER TABLE public.short_links
  ALTER COLUMN delivery_mode SET NOT NULL;

DO $$
BEGIN
  IF to_regclass('public.accounts') IS NOT NULL
    AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class rel ON rel.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = rel.relnamespace
    WHERE n.nspname = 'public'
      AND rel.relname = 'short_links'
      AND c.conname = 'short_links_sales_channel_id_fkey'
  ) THEN
    ALTER TABLE public.short_links
      ADD CONSTRAINT short_links_sales_channel_id_fkey
      FOREIGN KEY (sales_channel_id) REFERENCES public.sales_channels(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.orders') IS NOT NULL
    AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class rel ON rel.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = rel.relnamespace
    WHERE n.nspname = 'public'
      AND rel.relname = 'short_links'
      AND c.conname = 'short_links_order_id_fkey'
  ) THEN
    ALTER TABLE public.short_links
      ADD CONSTRAINT short_links_order_id_fkey
      FOREIGN KEY (order_id) REFERENCES public.orders(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.accounts') IS NOT NULL
    AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class rel ON rel.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = rel.relnamespace
    WHERE n.nspname = 'public'
      AND rel.relname = 'short_links'
      AND c.conname = 'short_links_account_id_fkey'
  ) THEN
    ALTER TABLE public.short_links
      ADD CONSTRAINT short_links_account_id_fkey
      FOREIGN KEY (account_id) REFERENCES public.accounts(id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;

ALTER TABLE public.short_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own short links" ON public.short_links;
CREATE POLICY "Users can manage own short links"
  ON public.short_links
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ------------------------------------------------------------
-- short_link_clicks
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.short_link_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  short_link_id UUID NOT NULL REFERENCES public.short_links(id) ON DELETE CASCADE,
  ip_address INET NOT NULL,
  user_agent TEXT,
  referer TEXT,
  country TEXT,
  device_type TEXT,
  is_suspicious BOOLEAN DEFAULT FALSE,
  suspicious_reason TEXT,
  clicked_at TIMESTAMPTZ DEFAULT now(),
  event_type TEXT NOT NULL DEFAULT 'redirect_click'
    CHECK (event_type IN ('bot_preview', 'landing_view', 'redirect_click', 'blocked'))
);

ALTER TABLE public.short_link_clicks
  ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'redirect_click'
    CHECK (event_type IN ('bot_preview', 'landing_view', 'redirect_click', 'blocked'));

UPDATE public.short_link_clicks
SET event_type = 'redirect_click'
WHERE event_type IS NULL;

ALTER TABLE public.short_link_clicks
  ALTER COLUMN event_type SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_slc_link_id
  ON public.short_link_clicks(short_link_id);
CREATE INDEX IF NOT EXISTS idx_slc_ip
  ON public.short_link_clicks(ip_address);
CREATE INDEX IF NOT EXISTS idx_slc_clicked_at
  ON public.short_link_clicks(clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_slc_link_clicked
  ON public.short_link_clicks(short_link_id, clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_slc_link_ip
  ON public.short_link_clicks(short_link_id, ip_address);
CREATE INDEX IF NOT EXISTS idx_short_link_clicks_event_type
  ON public.short_link_clicks(event_type);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class rel ON rel.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = rel.relnamespace
    WHERE n.nspname = 'public'
      AND rel.relname = 'short_link_clicks'
      AND c.conname = 'short_link_clicks_short_link_id_fkey'
  ) THEN
    ALTER TABLE public.short_link_clicks
      ADD CONSTRAINT short_link_clicks_short_link_id_fkey
      FOREIGN KEY (short_link_id) REFERENCES public.short_links(id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;

ALTER TABLE public.short_link_clicks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage clicks" ON public.short_link_clicks;
CREATE POLICY "Service role can manage clicks"
  ON public.short_link_clicks
  FOR ALL
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.short_link_clicks TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
