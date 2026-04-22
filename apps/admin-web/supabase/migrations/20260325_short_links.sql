-- Migration: Short Links (URL Shortener with click-limited access control)
-- Created: 2026-03-25

CREATE TABLE IF NOT EXISTS public.short_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  target_url TEXT NOT NULL,
  title TEXT,
  max_clicks INT NOT NULL DEFAULT 1,
  current_clicks INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'disabled')),
  order_id UUID,
  customer_id UUID,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_short_links_slug ON short_links(slug);
CREATE INDEX IF NOT EXISTS idx_short_links_account_id ON short_links(account_id);
CREATE INDEX IF NOT EXISTS idx_short_links_status ON short_links(status);

-- Atomic use_short_link: increment clicks and check limits in one transaction
CREATE OR REPLACE FUNCTION use_short_link(p_slug TEXT)
RETURNS TABLE(target_url TEXT, is_valid BOOLEAN, remaining INT) AS $$
DECLARE
  v_link RECORD;
BEGIN
  SELECT sl.* INTO v_link
  FROM short_links sl
  WHERE sl.slug = p_slug
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::TEXT, FALSE, 0;
    RETURN;
  END IF;

  IF v_link.status != 'active' THEN
    RETURN QUERY SELECT NULL::TEXT, FALSE, 0;
    RETURN;
  END IF;

  IF v_link.expires_at IS NOT NULL AND NOW() > v_link.expires_at THEN
    UPDATE short_links SET status = 'expired', updated_at = NOW() WHERE id = v_link.id;
    RETURN QUERY SELECT NULL::TEXT, FALSE, 0;
    RETURN;
  END IF;

  IF v_link.current_clicks >= v_link.max_clicks THEN
    UPDATE short_links SET status = 'expired', updated_at = NOW() WHERE id = v_link.id;
    RETURN QUERY SELECT NULL::TEXT, FALSE, 0;
    RETURN;
  END IF;

  UPDATE short_links
  SET current_clicks = current_clicks + 1,
      status = CASE WHEN current_clicks + 1 >= max_clicks THEN 'expired' ELSE 'active' END,
      updated_at = NOW()
  WHERE id = v_link.id;

  RETURN QUERY SELECT v_link.target_url, TRUE, (v_link.max_clicks - v_link.current_clicks - 1)::INT;
END;
$$ LANGUAGE plpgsql;

-- RLS policies
ALTER TABLE public.short_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own short links"
  ON public.short_links FOR ALL
  USING (account_id IN (
    SELECT account_id FROM admin_users WHERE id = auth.uid()
  ));
