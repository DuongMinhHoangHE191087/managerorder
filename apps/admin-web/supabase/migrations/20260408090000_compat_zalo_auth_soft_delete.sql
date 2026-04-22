-- ============================================================================
-- Compatibility migration for auth, Zalo/inventory, and legacy admin UI
-- Safe to run multiple times.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- Auth / RBAC compatibility helpers
-- ============================================================================

CREATE OR REPLACE FUNCTION public.normalize_admin_user_role(input_role text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(btrim(COALESCE(input_role, '')))
    WHEN 'admin' THEN 'admin_owner'
    WHEN 'staff' THEN 'sales_staff'
    WHEN 'viewer' THEN 'customer_support'
    ELSE NULLIF(lower(btrim(COALESCE(input_role, ''))), '')
  END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_admin_user_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.role := COALESCE(public.normalize_admin_user_role(NEW.role), 'sales_staff');
  NEW.status := COALESCE(NULLIF(btrim(COALESCE(NEW.status, '')), ''), 'active');
  NEW.display_name := COALESCE(
    NULLIF(btrim(COALESCE(NEW.display_name, '')), ''),
    NULLIF(btrim(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, '')), ''),
    NULLIF(btrim(split_part(COALESCE(NEW.email, ''), '@', 1)), ''),
    'User'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_users_normalize_write ON public.admin_users;
CREATE TRIGGER trg_admin_users_normalize_write
BEFORE INSERT OR UPDATE ON public.admin_users
FOR EACH ROW
EXECUTE FUNCTION public.normalize_admin_user_write();

CREATE OR REPLACE FUNCTION public.run_auth_migration()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  ALTER TABLE IF EXISTS public.admin_users
    ADD COLUMN IF NOT EXISTS password_hash text,
    ADD COLUMN IF NOT EXISTS first_name text,
    ADD COLUMN IF NOT EXISTS last_name text,
    ADD COLUMN IF NOT EXISTS display_name text,
    ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

  ALTER TABLE IF EXISTS public.admin_users
    ADD COLUMN IF NOT EXISTS full_name text GENERATED ALWAYS AS (
      CASE
        WHEN NULLIF(btrim(display_name), '') IS NOT NULL THEN btrim(display_name)
        WHEN NULLIF(btrim(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), '') IS NOT NULL
          THEN NULLIF(btrim(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), '')
        ELSE NULLIF(btrim(split_part(COALESCE(email, ''), '@', 1)), '')
      END
    ) STORED;

  WITH base AS (
    SELECT
      id,
      COALESCE(
        NULLIF(btrim(COALESCE(display_name, '')), ''),
        NULLIF(btrim(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), ''),
        NULLIF(btrim(split_part(COALESCE(email, ''), '@', 1)), ''),
        'User'
      ) AS display_name_candidate,
      COALESCE(NULLIF(btrim(COALESCE(status, '')), ''), 'active') AS status_candidate,
      COALESCE(public.normalize_admin_user_role(role), 'sales_staff') AS role_candidate
    FROM public.admin_users
  ),
  normalized AS (
    SELECT
      id,
      display_name_candidate,
      COALESCE(NULLIF(btrim(split_part(display_name_candidate, ' ', 1)), ''), 'User') AS first_name_candidate,
      COALESCE(
        NULLIF(
          btrim(
            CASE
              WHEN POSITION(' ' IN display_name_candidate) > 0
                THEN SUBSTRING(display_name_candidate FROM POSITION(' ' IN display_name_candidate) + 1)
              ELSE ''
            END
          ),
          ''
        ),
        ''
      ) AS last_name_candidate,
      status_candidate,
      role_candidate
    FROM base
  )
  UPDATE public.admin_users a
  SET
    display_name = n.display_name_candidate,
    first_name = n.first_name_candidate,
    last_name = n.last_name_candidate,
    status = n.status_candidate,
    role = n.role_candidate
  FROM normalized n
  WHERE a.id = n.id
    AND (
      a.display_name IS NULL
      OR btrim(COALESCE(a.display_name, '')) = ''
      OR a.first_name IS NULL
      OR btrim(COALESCE(a.first_name, '')) = ''
      OR a.last_name IS NULL
      OR btrim(COALESCE(a.last_name, '')) = ''
      OR a.status IS NULL
      OR btrim(COALESCE(a.status, '')) = ''
      OR a.role IN ('admin', 'staff', 'viewer')
      OR a.role IS NULL
      OR btrim(COALESCE(a.role, '')) = ''
    );

  CREATE INDEX IF NOT EXISTS idx_admin_users_account_email
    ON public.admin_users(account_id, email);

  CREATE INDEX IF NOT EXISTS idx_admin_users_account_id
    ON public.admin_users(account_id);
END;
$$;

SELECT public.run_auth_migration();

-- ============================================================================
-- Customer and customer grouping compatibility
-- ============================================================================

ALTER TABLE IF EXISTS public.customers
  ADD COLUMN IF NOT EXISTS group_id uuid,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE IF EXISTS public.customers
  ADD COLUMN IF NOT EXISTS nicks_registry jsonb DEFAULT '[]'::jsonb;

UPDATE public.customers c
SET
  phone = COALESCE(
    NULLIF(btrim(COALESCE(c.phone, '')), ''),
    (
      SELECT NULLIF(btrim(cc.value), '')
      FROM public.customer_contacts cc
      WHERE cc.customer_id = c.id
        AND lower(cc.channel) = 'phone'
      ORDER BY cc.is_verified DESC, cc.created_at ASC
      LIMIT 1
    )
  ),
  email = COALESCE(
    NULLIF(btrim(COALESCE(c.email, '')), ''),
    (
      SELECT NULLIF(btrim(cc.value), '')
      FROM public.customer_contacts cc
      WHERE cc.customer_id = c.id
        AND lower(cc.channel) = 'email'
      ORDER BY cc.is_verified DESC, cc.created_at ASC
      LIMIT 1
    )
  ),
  nicks_registry = COALESCE(c.nicks_registry, '[]'::jsonb)
WHERE c.phone IS NULL
   OR btrim(COALESCE(c.phone, '')) = ''
   OR c.email IS NULL
   OR btrim(COALESCE(c.email, '')) = ''
   OR c.nicks_registry IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'customer_groups'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'customers_group_id_fkey'
  ) THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT customers_group_id_fkey
      FOREIGN KEY (group_id)
      REFERENCES public.customer_groups(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_customers_account_deleted_at
  ON public.customers(account_id, deleted_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_customers_group_id
  ON public.customers(group_id);

ALTER TABLE IF EXISTS public.customer_groups
  ADD COLUMN IF NOT EXISTS color text DEFAULT '#6366f1',
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS rules jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'customer_groups'
  ) THEN
    UPDATE public.customer_groups
    SET
      color = COALESCE(NULLIF(btrim(COALESCE(color, '')), ''), '#6366f1'),
      rules = COALESCE(rules, '{}'::jsonb),
      updated_at = COALESCE(updated_at, now())
    WHERE color IS NULL
       OR btrim(COALESCE(color, '')) = ''
       OR rules IS NULL
       OR updated_at IS NULL;
  END IF;
END $$;

ALTER TABLE IF EXISTS public.customer_tags
  ADD COLUMN IF NOT EXISTS color text DEFAULT '#6366f1';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'customer_tags'
  ) THEN
    UPDATE public.customer_tags
    SET color = COALESCE(NULLIF(btrim(COALESCE(color, '')), ''), '#6366f1')
    WHERE color IS NULL OR btrim(COALESCE(color, '')) = '';
  END IF;
END $$;

ALTER TABLE IF EXISTS public.customer_tag_assignments
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'customer_tag_assignments'
  ) THEN
    UPDATE public.customer_tag_assignments
    SET assigned_at = COALESCE(assigned_at, now())
    WHERE assigned_at IS NULL;
  END IF;
END $$;

-- Improve duplicate detection for contact imports and Zalo/phone matching.
CREATE INDEX IF NOT EXISTS idx_customer_contacts_value_lower
  ON public.customer_contacts (lower(value));

-- ============================================================================
-- Orders and order items compatibility
-- ============================================================================

ALTER TABLE IF EXISTS public.orders
  ADD COLUMN IF NOT EXISTS order_code varchar(50),
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE IF EXISTS public.orders
  ADD COLUMN IF NOT EXISTS notes text GENERATED ALWAYS AS (sales_note) STORED;

UPDATE public.orders
SET order_code = 'DMH_' || upper(replace(left(id::text, 8), '-', ''))
WHERE order_code IS NULL
   OR btrim(COALESCE(order_code, '')) = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_account_order_code
  ON public.orders(account_id, order_code)
  WHERE order_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_account_deleted_at
  ON public.orders(account_id, deleted_at)
  WHERE deleted_at IS NULL;

ALTER TABLE IF EXISTS public.order_items
  ADD COLUMN IF NOT EXISTS customer_nick_used text;

CREATE INDEX IF NOT EXISTS idx_order_items_customer_nick_used
  ON public.order_items(customer_nick_used)
  WHERE customer_nick_used IS NOT NULL;

-- ============================================================================
-- Product, provider, inventory, and purchase order compatibility
-- ============================================================================

ALTER TABLE IF EXISTS public.products
  ADD COLUMN IF NOT EXISTS price_vnd numeric GENERATED ALWAYS AS (sell_price_vnd) STORED,
  ADD COLUMN IF NOT EXISTS cost_vnd numeric GENERATED ALWAYS AS (buy_price_vnd) STORED,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_products_account_deleted_at
  ON public.products(account_id, deleted_at)
  WHERE deleted_at IS NULL;

ALTER TABLE IF EXISTS public.providers
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_providers_account_deleted_at
  ON public.providers(account_id, deleted_at)
  WHERE deleted_at IS NULL;

ALTER TABLE IF EXISTS public.source_accounts
  ADD COLUMN IF NOT EXISTS notes jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS reserved_nicks text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

UPDATE public.source_accounts
SET status = COALESCE(NULLIF(btrim(COALESCE(status, '')), ''), 'active'),
    notes = COALESCE(notes, '{}'::jsonb),
    reserved_nicks = COALESCE(reserved_nicks, '{}'::text[])
WHERE status IS NULL
   OR btrim(COALESCE(status, '')) = ''
   OR notes IS NULL
   OR reserved_nicks IS NULL;

CREATE INDEX IF NOT EXISTS idx_source_accounts_account_deleted_at
  ON public.source_accounts(account_id, deleted_at)
  WHERE deleted_at IS NULL;

ALTER TABLE IF EXISTS public.license_keys
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_license_keys_account_deleted_at
  ON public.license_keys(account_id, deleted_at)
  WHERE deleted_at IS NULL;

ALTER TABLE IF EXISTS public.purchase_orders
  ADD COLUMN IF NOT EXISTS account_id uuid,
  ADD COLUMN IF NOT EXISTS provider_id uuid,
  ADD COLUMN IF NOT EXISTS items jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS total_amount_vnd numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_paid_vnd numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS received_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'purchase_orders'
  ) THEN
    EXECUTE $sql$
      UPDATE public.purchase_orders
      SET
        status = COALESCE(NULLIF(btrim(COALESCE(status, '')), ''), 'pending'),
        items = COALESCE(items, '[]'::jsonb),
        total_amount_vnd = COALESCE(total_amount_vnd, 0),
        total_paid_vnd = COALESCE(total_paid_vnd, 0),
        created_at = COALESCE(created_at, now()),
        updated_at = COALESCE(updated_at, now())
      WHERE status IS NULL
         OR btrim(COALESCE(status, '')) = ''
         OR items IS NULL
         OR total_amount_vnd IS NULL
         OR total_paid_vnd IS NULL
         OR created_at IS NULL
         OR updated_at IS NULL
    $sql$;

    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_purchase_orders_account_deleted_at ON public.purchase_orders(account_id, deleted_at) WHERE deleted_at IS NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_purchase_orders_account_provider ON public.purchase_orders(account_id, provider_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_purchase_orders_provider_id ON public.purchase_orders(provider_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_purchase_orders_account_id ON public.purchase_orders(account_id)';
  END IF;
END $$;

-- ============================================================================
-- Misc settings compatibility
-- ============================================================================

ALTER TABLE IF EXISTS public.system_settings
  ADD COLUMN IF NOT EXISTS qr_transfer_content text;
