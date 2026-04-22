-- ============================================================
-- Migration: short-link delivery policies + sales channel defaults
-- Created: 2026-04-13
-- ============================================================

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

CREATE INDEX IF NOT EXISTS idx_sales_channels_account_id ON public.sales_channels(account_id);

ALTER TABLE public.sales_channels ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF to_regclass('public.premium_accounts') IS NOT NULL THEN
    IF NOT EXISTS (
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
        FOREIGN KEY (account_id) REFERENCES public.premium_accounts(id)
        ON DELETE CASCADE
        NOT VALID;
    END IF;
  END IF;
END $$;

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

ALTER TABLE public.short_links
  ADD COLUMN IF NOT EXISTS locked_ipv6 INET,
  ADD COLUMN IF NOT EXISTS sales_channel_id UUID NULL REFERENCES public.sales_channels(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_mode TEXT NOT NULL DEFAULT 'inherit_channel'
    CHECK (delivery_mode IN ('inherit_channel', 'direct_redirect', 'landing_page')),
  ADD COLUMN IF NOT EXISTS landing_template_key TEXT NULL
    CHECK (landing_template_key IN ('owner_intro', 'ctv_neutral'));

UPDATE public.short_links
SET delivery_mode = 'direct_redirect'
WHERE delivery_mode IS NULL;

CREATE INDEX IF NOT EXISTS idx_short_links_sales_channel_id ON public.short_links(sales_channel_id);
CREATE INDEX IF NOT EXISTS idx_short_links_delivery_mode ON public.short_links(delivery_mode);

ALTER TABLE public.short_link_clicks
  ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'redirect_click'
    CHECK (event_type IN ('bot_preview', 'landing_view', 'redirect_click', 'blocked'));

CREATE INDEX IF NOT EXISTS idx_short_link_clicks_event_type
  ON public.short_link_clicks(event_type);

NOTIFY pgrst, 'reload schema';
