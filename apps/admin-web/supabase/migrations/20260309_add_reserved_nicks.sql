-- Add reserved_nicks column to source_accounts
-- Allows sellers to pre-register customer nicks before an order is created.
-- Smart Match will cross-reference this list when suggesting connections.
ALTER TABLE source_accounts
  ADD COLUMN IF NOT EXISTS reserved_nicks TEXT[] DEFAULT '{}';
