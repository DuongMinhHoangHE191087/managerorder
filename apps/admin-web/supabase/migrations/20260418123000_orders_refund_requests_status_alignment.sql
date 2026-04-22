-- ============================================================
-- Migration: align refund request status constraint with live types
-- Created: 2026-04-18
-- Purpose:
--   - keep refund_requests.status aligned with generated types
--   - preserve live data while allowing future cancelled refunds
-- ============================================================

DO $$
DECLARE
  r record;
  has_compatible_constraint boolean := false;
BEGIN
  IF to_regclass('public.refund_requests') IS NULL THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT c.conname, pg_get_constraintdef(c.oid) AS condef
    FROM pg_constraint c
    JOIN pg_class rel ON rel.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = rel.relnamespace
    WHERE n.nspname = 'public'
      AND rel.relname = 'refund_requests'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%status%'
  LOOP
    IF position('cancelled' in lower(r.condef)) > 0 THEN
      has_compatible_constraint := true;
    ELSE
      EXECUTE format('ALTER TABLE public.refund_requests DROP CONSTRAINT %I', r.conname);
    END IF;
  END LOOP;

  IF NOT has_compatible_constraint THEN
    ALTER TABLE public.refund_requests
      ADD CONSTRAINT refund_requests_status_check
      CHECK (status IN ('requested', 'approved', 'processing', 'completed', 'rejected', 'cancelled'));
  END IF;
END $$;

