-- ============================================================
-- Migration: account share vault
-- Created: 2026-05-06
-- Purpose: controlled public sharing for source account credentials.
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.account_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  source_account_id UUID NOT NULL,
  order_id UUID NULL,
  order_item_id UUID NULL,
  customer_id UUID NULL,
  short_link_id UUID NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disabled', 'expired')),
  expires_at TIMESTAMPTZ NULL,
  max_views INT NOT NULL DEFAULT 20,
  view_count INT NOT NULL DEFAULT 0,
  max_unlocks INT NOT NULL DEFAULT 10,
  unlock_count INT NOT NULL DEFAULT 0,
  passcode_hash TEXT NULL,
  exposure_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  access_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  locked_ip INET NULL,
  locked_ipv6 INET NULL,
  created_by TEXT NULL,
  deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.account_share_links
  ADD COLUMN IF NOT EXISTS account_id UUID,
  ADD COLUMN IF NOT EXISTS source_account_id UUID,
  ADD COLUMN IF NOT EXISTS order_id UUID NULL,
  ADD COLUMN IF NOT EXISTS order_item_id UUID NULL,
  ADD COLUMN IF NOT EXISTS customer_id UUID NULL,
  ADD COLUMN IF NOT EXISTS short_link_id UUID NULL,
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS title TEXT NULL,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disabled', 'expired')),
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS max_views INT NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS view_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_unlocks INT NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS unlock_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS passcode_hash TEXT NULL,
  ADD COLUMN IF NOT EXISTS exposure_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS access_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS locked_ip INET NULL,
  ADD COLUMN IF NOT EXISTS locked_ipv6 INET NULL,
  ADD COLUMN IF NOT EXISTS created_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS idx_account_share_links_slug
  ON public.account_share_links(slug);
CREATE INDEX IF NOT EXISTS idx_account_share_links_account_id
  ON public.account_share_links(account_id);
CREATE INDEX IF NOT EXISTS idx_account_share_links_source_account_id
  ON public.account_share_links(source_account_id);
CREATE INDEX IF NOT EXISTS idx_account_share_links_order_item_id
  ON public.account_share_links(order_item_id);
CREATE INDEX IF NOT EXISTS idx_account_share_links_status
  ON public.account_share_links(status);
CREATE INDEX IF NOT EXISTS idx_account_share_links_deleted_at
  ON public.account_share_links(deleted_at);

DO $$
BEGIN
  IF to_regclass('public.accounts') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class rel ON rel.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = rel.relnamespace
      WHERE n.nspname = 'public'
        AND rel.relname = 'account_share_links'
        AND c.conname = 'account_share_links_account_id_fkey'
    ) THEN
    ALTER TABLE public.account_share_links
      ADD CONSTRAINT account_share_links_account_id_fkey
      FOREIGN KEY (account_id) REFERENCES public.accounts(id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;

  IF to_regclass('public.source_accounts') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class rel ON rel.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = rel.relnamespace
      WHERE n.nspname = 'public'
        AND rel.relname = 'account_share_links'
        AND c.conname = 'account_share_links_source_account_id_fkey'
    ) THEN
    ALTER TABLE public.account_share_links
      ADD CONSTRAINT account_share_links_source_account_id_fkey
      FOREIGN KEY (source_account_id) REFERENCES public.source_accounts(id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;

  IF to_regclass('public.orders') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class rel ON rel.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = rel.relnamespace
      WHERE n.nspname = 'public'
        AND rel.relname = 'account_share_links'
        AND c.conname = 'account_share_links_order_id_fkey'
    ) THEN
    ALTER TABLE public.account_share_links
      ADD CONSTRAINT account_share_links_order_id_fkey
      FOREIGN KEY (order_id) REFERENCES public.orders(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;

  IF to_regclass('public.order_items') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class rel ON rel.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = rel.relnamespace
      WHERE n.nspname = 'public'
        AND rel.relname = 'account_share_links'
        AND c.conname = 'account_share_links_order_item_id_fkey'
    ) THEN
    ALTER TABLE public.account_share_links
      ADD CONSTRAINT account_share_links_order_item_id_fkey
      FOREIGN KEY (order_item_id) REFERENCES public.order_items(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;

  IF to_regclass('public.short_links') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class rel ON rel.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = rel.relnamespace
      WHERE n.nspname = 'public'
        AND rel.relname = 'account_share_links'
        AND c.conname = 'account_share_links_short_link_id_fkey'
    ) THEN
    ALTER TABLE public.account_share_links
      ADD CONSTRAINT account_share_links_short_link_id_fkey
      FOREIGN KEY (short_link_id) REFERENCES public.short_links(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.account_share_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_share_link_id UUID NOT NULL REFERENCES public.account_share_links(id) ON DELETE CASCADE,
  account_id UUID NOT NULL,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('unlock', 'view', 'copy', 'totp_view', 'blocked')),
  ip_address INET NULL,
  ip_version TEXT NULL,
  user_agent TEXT NULL,
  reason TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.account_share_access_logs
  ADD COLUMN IF NOT EXISTS account_share_link_id UUID,
  ADD COLUMN IF NOT EXISTS account_id UUID,
  ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'view'
    CHECK (event_type IN ('unlock', 'view', 'copy', 'totp_view', 'blocked')),
  ADD COLUMN IF NOT EXISTS ip_address INET NULL,
  ADD COLUMN IF NOT EXISTS ip_version TEXT NULL,
  ADD COLUMN IF NOT EXISTS user_agent TEXT NULL,
  ADD COLUMN IF NOT EXISTS reason TEXT NULL,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_account_share_access_logs_link_id
  ON public.account_share_access_logs(account_share_link_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_share_access_logs_account_id
  ON public.account_share_access_logs(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_share_access_logs_event_type
  ON public.account_share_access_logs(event_type);

CREATE OR REPLACE FUNCTION public.consume_account_share_view(p_link_id UUID)
RETURNS SETOF public.account_share_links
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.account_share_links
     SET view_count = view_count + 1,
         updated_at = NOW()
   WHERE id = p_link_id
     AND deleted_at IS NULL
     AND (max_views <= 0 OR view_count < max_views)
  RETURNING *;
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_account_share_unlock(p_link_id UUID)
RETURNS SETOF public.account_share_links
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.account_share_links
     SET unlock_count = unlock_count + 1,
         updated_at = NOW()
   WHERE id = p_link_id
     AND deleted_at IS NULL
     AND (max_unlocks <= 0 OR unlock_count < max_unlocks)
  RETURNING *;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class rel ON rel.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = rel.relnamespace
    WHERE n.nspname = 'public'
      AND rel.relname = 'account_share_access_logs'
      AND c.conname = 'account_share_access_logs_link_id_fkey'
  ) THEN
    ALTER TABLE public.account_share_access_logs
      ADD CONSTRAINT account_share_access_logs_link_id_fkey
      FOREIGN KEY (account_share_link_id) REFERENCES public.account_share_links(id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;

ALTER TABLE public.account_share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_share_access_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "tenant_isolation" ON public.account_share_links';
  EXECUTE 'DROP POLICY IF EXISTS "tenant_isolation" ON public.account_share_access_logs';

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_user_account_id'
  ) THEN
    EXECUTE 'CREATE POLICY "tenant_isolation"
      ON public.account_share_links
      FOR ALL TO authenticated
      USING (account_id = public.get_user_account_id())
      WITH CHECK (account_id = public.get_user_account_id())';

    EXECUTE 'CREATE POLICY "tenant_isolation"
      ON public.account_share_access_logs
      FOR SELECT TO authenticated
      USING (account_id = public.get_user_account_id())';
  END IF;
END $$;

GRANT ALL ON public.account_share_links TO service_role;
GRANT ALL ON public.account_share_access_logs TO service_role;
REVOKE ALL ON FUNCTION public.consume_account_share_view(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_account_share_view(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.consume_account_share_view(UUID) FROM authenticated;
REVOKE ALL ON FUNCTION public.consume_account_share_unlock(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_account_share_unlock(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.consume_account_share_unlock(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.consume_account_share_view(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_account_share_unlock(UUID) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
