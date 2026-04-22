DO $$
BEGIN
  IF to_regclass('public.system_settings') IS NOT NULL THEN
    ALTER TABLE public.system_settings
      ADD COLUMN IF NOT EXISTS sales_landing_config jsonb NOT NULL DEFAULT '{"offers":[]}'::jsonb;
  END IF;
END $$;

COMMENT ON COLUMN public.system_settings.sales_landing_config IS
  'Snapshot landing cards shown on public/error pages. Stores product snapshots and custom links.';
