-- Ensure nicks_registry column exists on customers table.
-- This column is used by smart-matching service for nick-based order matching.
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS nicks_registry jsonb DEFAULT '[]'::jsonb;
