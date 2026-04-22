-- Migration: escalation_rules
-- Module 5.2 - Auto-Escalation Engine
-- Configurable rules: overdue_days / debt_amount / no_payment -> action

CREATE TABLE IF NOT EXISTS escalation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('overdue_days', 'debt_amount', 'no_payment')),
  threshold_value NUMERIC NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('reminder', 'warning', 'lock_service', 'notify_admin')),
  action_config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance indices
CREATE INDEX IF NOT EXISTS idx_er_account ON escalation_rules(account_id);
CREATE INDEX IF NOT EXISTS idx_er_active ON escalation_rules(is_active) WHERE is_active = true;
