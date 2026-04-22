-- ============================================================
-- MIGRATION: Short Link Anti-Fraud System
-- Creates click tracking table + adds token/IP lock columns
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Create click tracking table
CREATE TABLE IF NOT EXISTS short_link_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  short_link_id UUID NOT NULL REFERENCES short_links(id) ON DELETE CASCADE,
  ip_address INET NOT NULL,
  user_agent TEXT,
  referer TEXT,
  country TEXT,
  device_type TEXT,          -- mobile | desktop | tablet | bot
  is_suspicious BOOLEAN DEFAULT FALSE,
  suspicious_reason TEXT,
  clicked_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_slc_link_id ON short_link_clicks(short_link_id);
CREATE INDEX IF NOT EXISTS idx_slc_ip ON short_link_clicks(ip_address);
CREATE INDEX IF NOT EXISTS idx_slc_clicked_at ON short_link_clicks(clicked_at DESC);

-- 2b. Composite indexes for analytics + fraud detection performance
CREATE INDEX IF NOT EXISTS idx_slc_link_clicked ON short_link_clicks(short_link_id, clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_slc_link_ip ON short_link_clicks(short_link_id, ip_address);

-- 3. Add anti-fraud columns to short_links
ALTER TABLE short_links
  ADD COLUMN IF NOT EXISTS access_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS locked_ip INET,
  ADD COLUMN IF NOT EXISTS require_token BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS notify_clicks BOOLEAN DEFAULT FALSE;

-- 4. Index for token lookup
CREATE INDEX IF NOT EXISTS idx_sl_access_token ON short_links(access_token) WHERE access_token IS NOT NULL;

-- 5. RLS policies for short_link_clicks (admin-only read)
ALTER TABLE short_link_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage clicks"
  ON short_link_clicks
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 6. Grant service role full access
GRANT ALL ON short_link_clicks TO service_role;
