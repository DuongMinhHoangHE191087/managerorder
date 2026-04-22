-- Migration: Increase bulk_import_orders batch limit from 200 to 20,000
-- This replaces the hardcoded limit in the PL/pgSQL function

DO $$
DECLARE
  fn_source TEXT;
  fn_full TEXT;
BEGIN
  -- Get the full function definition
  SELECT pg_get_functiondef(p.oid) INTO fn_full
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE p.proname = 'bulk_import_orders'
    AND n.nspname = 'public'
  LIMIT 1;

  IF fn_full IS NULL THEN
    RAISE NOTICE 'Function bulk_import_orders not found, skipping migration';
    RETURN;
  END IF;

  -- Replace the old batch limit (200) with the new one (20000)
  -- The function checks: IF array_length(p_orders, 1) > 200 THEN
  fn_full := replace(fn_full, '> 200 THEN', '> 20000 THEN');
  -- Also update the error message
  fn_full := replace(fn_full, '(max 200)', '(max 20000)');

  -- Execute the modified function definition to replace it
  EXECUTE fn_full;

  RAISE NOTICE 'Successfully updated bulk_import_orders batch limit from 200 to 20000';
END;
$$;
