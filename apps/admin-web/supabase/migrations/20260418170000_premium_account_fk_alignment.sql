-- Strengthen tenant ownership for premium tables.
-- This keeps premium data scoped to public.accounts while preserving existing rows.

DO $$
DECLARE
  spec record;
  has_account_column boolean;
  has_correct_constraint boolean;
  has_any_constraint boolean;
BEGIN
  IF to_regclass('public.accounts') IS NULL THEN
    RAISE NOTICE 'Skipping premium FK alignment because public.accounts is missing';
    RETURN;
  END IF;

  FOR spec IN
    SELECT *
    FROM (VALUES
      ('premium_accounts', 'premium_accounts_account_id_fkey'),
      ('premium_account_users', 'premium_account_users_account_id_fkey'),
      ('premium_service_types', 'premium_service_types_account_id_fkey'),
      ('premium_packages', 'premium_packages_account_id_fkey'),
      ('customer_premium_subscriptions', 'customer_premium_subscriptions_account_id_fkey'),
      ('account_migrations', 'account_migrations_account_id_fkey'),
      ('account_migration_history', 'account_migration_history_account_id_fkey'),
      ('premium_account_health_logs', 'premium_account_health_logs_account_id_fkey'),
      ('premium_account_user_history', 'premium_account_user_history_account_id_fkey')
    ) AS t(table_name, constraint_name)
  LOOP
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = spec.table_name
        AND column_name = 'account_id'
    ) INTO has_account_column;

    IF NOT has_account_column THEN
      RAISE NOTICE 'Skipping %.account_id because the column is missing', spec.table_name;
      CONTINUE;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_class r ON r.oid = c.confrelid
      JOIN pg_namespace rn ON rn.oid = r.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = spec.table_name
        AND c.conname = spec.constraint_name
        AND c.contype = 'f'
        AND rn.nspname = 'public'
        AND r.relname = 'accounts'
    ) INTO has_correct_constraint;

    SELECT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = spec.table_name
        AND c.conname = spec.constraint_name
    ) INTO has_any_constraint;

    IF has_any_constraint AND NOT has_correct_constraint THEN
      EXECUTE format(
        'ALTER TABLE public.%I DROP CONSTRAINT %I',
        spec.table_name,
        spec.constraint_name
      );
    END IF;

    IF NOT has_correct_constraint THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE NOT VALID',
        spec.table_name,
        spec.constraint_name
      );
    END IF;
  END LOOP;
END $$;
