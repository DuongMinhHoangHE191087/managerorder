-- Migration to add missing columns to short_links table
-- These columns are referenced by the API and Repo but were missing from the initial migration

ALTER TABLE public.short_links
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS access_token TEXT,
ADD COLUMN IF NOT EXISTS locked_ip TEXT,
ADD COLUMN IF NOT EXISTS require_token BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS notify_clicks BOOLEAN DEFAULT false;

-- Add index for deleted_at since it's used in queries
CREATE INDEX IF NOT EXISTS idx_short_links_deleted_at ON short_links(deleted_at);
