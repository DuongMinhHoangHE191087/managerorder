-- ============================================================================
-- Migration: Resolve tenant account from Supabase JWT email claim
-- Description: Keep the tenant helper compatible with the current auth model.
--              `admin_users.id` is an app-level UUID, not the Supabase auth.uid().
--              We therefore resolve the tenant from the JWT email claim first,
--              with auth.uid() retained as a legacy fallback for older setups.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_account_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id UUID;
  v_email TEXT;
BEGIN
  IF to_regclass('public.admin_users') IS NULL THEN
    RETURN NULL;
  END IF;

  v_email := nullif(lower(btrim(coalesce(auth.jwt() ->> 'email', ''))), '');
  IF v_email IS NOT NULL THEN
    SELECT account_id
      INTO v_account_id
    FROM public.admin_users
    WHERE lower(email) = v_email
    LIMIT 1;

    IF v_account_id IS NOT NULL THEN
      RETURN v_account_id;
    END IF;
  END IF;

  SELECT account_id
    INTO v_account_id
  FROM public.admin_users
  WHERE id = auth.uid()
  LIMIT 1;

  RETURN v_account_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_account_id() TO authenticated;
