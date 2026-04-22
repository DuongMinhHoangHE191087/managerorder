-- Migration to add 'notes' column to source_accounts table for storing dynamic credentials (2FA, etc.)

ALTER TABLE public.source_accounts 
ADD COLUMN IF NOT EXISTS notes JSONB DEFAULT '{}'::jsonb;
