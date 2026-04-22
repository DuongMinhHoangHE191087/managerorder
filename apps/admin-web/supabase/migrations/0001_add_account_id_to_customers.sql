ALTER TABLE IF EXISTS public.customers ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.premium_accounts(id);
ALTER TABLE IF EXISTS public.providers ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.premium_accounts(id);
NOTIFY pgrst, reload schema;
