-- Migration: webhook_endpoints + webhook_events
-- Module 5.3 - Webhook/Events System
-- Allows external systems to subscribe to events via HTTP callbacks

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  url TEXT NOT NULL,
  secret TEXT NOT NULL, -- HMAC-SHA256 signing secret
  events TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  consecutive_failures INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  endpoint_id UUID REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed', 'skipped')),
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  last_attempt_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  response_status INT,
  response_body TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance indices
CREATE INDEX IF NOT EXISTS idx_wep_account ON webhook_endpoints(account_id);
CREATE INDEX IF NOT EXISTS idx_we_endpoint ON webhook_events(endpoint_id);
CREATE INDEX IF NOT EXISTS idx_we_status ON webhook_events(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_we_created ON webhook_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_we_account ON webhook_events(account_id);
