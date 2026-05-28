-- Migration to add deleted_at columns for soft-delete support
ALTER TABLE reminder_events ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE subscription_renewals ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE account_migrations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
