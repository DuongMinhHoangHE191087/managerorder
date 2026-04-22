-- Migration: reminder_logs
-- Module 5.1 - Advanced Telegram Reminders
-- Tracks all sent reminders (T-7, T-3, T-1, overdue, escalation) 
-- with deduplication support

CREATE TABLE IF NOT EXISTS reminder_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  reminder_type TEXT NOT NULL, -- 'T-7', 'T-3', 'T-1', 'overdue', 'escalation_reminder', 'escalation_warning', 'escalation_lock'
  channel TEXT NOT NULL DEFAULT 'telegram', -- 'telegram', 'email'
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'acknowledged')),
  message_content TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance indices
CREATE INDEX IF NOT EXISTS idx_rl_order_id ON reminder_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_rl_customer_id ON reminder_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_rl_sent_at ON reminder_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_rl_account ON reminder_logs(account_id);

-- Prevent duplicate reminders for same order on same day
CREATE UNIQUE INDEX IF NOT EXISTS idx_rl_unique_reminder 
  ON reminder_logs(order_id, reminder_type, (sent_at::date));
