-- Drop the old INTEGER overload of increment_source_account_slots
-- that conflicts with the UUID version (from migration 20260308000001).
-- PostgreSQL cannot disambiguate between the two when called via Supabase RPC.

DROP FUNCTION IF EXISTS increment_source_account_slots(UUID, INTEGER, INTEGER);
