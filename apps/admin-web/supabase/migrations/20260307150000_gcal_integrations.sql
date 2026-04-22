-- Create integrations table for OAuth tokens
CREATE TABLE IF NOT EXISTS public.integrations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id text NOT NULL, -- or uuid if matches your account_id type
  provider text NOT NULL,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add unique constraint for account and provider
CREATE UNIQUE INDEX IF NOT EXISTS integrations_account_provider_idx ON public.integrations(account_id, provider);

-- Add gcal_event_id to reminder_events
ALTER TABLE public.reminder_events
ADD COLUMN IF NOT EXISTS gcal_event_id text;
