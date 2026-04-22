-- ============================================================
-- Migration: Atomic Allocation Confirmation with Advisory Lock
-- ============================================================

-- RPC: Confirm allocation atomically using pg_advisory_xact_lock
-- This prevents concurrent allocation requests from double-allocating resources
CREATE OR REPLACE FUNCTION confirm_allocation_atomic(
  p_order_id uuid,
  p_account_id uuid,
  p_allocations jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_alloc jsonb;
  v_order_status text;
  v_rows_affected int;
BEGIN
  -- Advisory lock per order — blocks concurrent allocations for same order
  PERFORM pg_advisory_xact_lock(hashtext(p_order_id::text));

  -- Double-check order still in valid state
  SELECT status INTO v_order_status FROM orders
    WHERE id = p_order_id AND account_id = p_account_id AND deleted_at IS NULL;

  IF v_order_status IS NULL THEN
    RAISE EXCEPTION 'Order not found or deleted: %', p_order_id;
  END IF;

  -- Process each allocation
  FOR v_alloc IN SELECT * FROM jsonb_array_elements(p_allocations)
  LOOP
    -- Slot allocation: atomic increment with capacity check
    IF (v_alloc->>'source_account_id') IS NOT NULL THEN
      UPDATE source_accounts
        SET used_slots = used_slots + (v_alloc->>'quantity')::int,
            updated_at = now()
        WHERE id = (v_alloc->>'source_account_id')::uuid
          AND account_id = p_account_id
          AND used_slots + (v_alloc->>'quantity')::int <= max_slots;
      GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
      IF v_rows_affected = 0 THEN
        RAISE EXCEPTION 'Không đủ slot cho source_account %', v_alloc->>'source_account_id';
      END IF;

      -- Record assignment on order_item
      UPDATE order_items
        SET assigned_source_account_id = (v_alloc->>'source_account_id')::uuid
        WHERE id = (v_alloc->>'order_item_id')::uuid;
    END IF;

    -- Key allocation: atomically assign available keys
    IF (v_alloc->>'requires_key')::boolean THEN
      WITH keys_to_assign AS (
        SELECT id FROM license_keys
          WHERE account_id = p_account_id
            AND product_id = (v_alloc->>'product_id')::uuid
            AND status = 'available'
          ORDER BY created_at ASC
          LIMIT (v_alloc->>'quantity')::int
          FOR UPDATE SKIP LOCKED
      )
      UPDATE license_keys lk
        SET status = 'used',
            order_id = p_order_id,
            assigned_at = now(),
            updated_at = now()
        FROM keys_to_assign kta
        WHERE lk.id = kta.id;

      GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
      IF v_rows_affected < (v_alloc->>'quantity')::int THEN
        RAISE EXCEPTION 'Không đủ key cho product %', v_alloc->>'product_id';
      END IF;
    END IF;
  END LOOP;

  -- Advance order status to active
  UPDATE orders
    SET status = 'active', updated_at = now()
    WHERE id = p_order_id AND account_id = p_account_id;

  RETURN jsonb_build_object('success', true, 'order_id', p_order_id);
END;
$$;

-- RPC: Batch deallocate — release all allocations for an order atomically
CREATE OR REPLACE FUNCTION deallocate_order_atomic(
  p_order_id uuid,
  p_account_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deallocated_slots int := 0;
  v_deallocated_keys int := 0;
  v_source_ids uuid[];
BEGIN
  -- Advisory lock to prevent concurrent deallocation
  PERFORM pg_advisory_xact_lock(hashtext(p_order_id::text));

  -- 1. Collect affected source accounts before clearing assignments
  SELECT ARRAY_AGG(DISTINCT assigned_source_account_id)
    INTO v_source_ids
    FROM order_items
    WHERE order_id = p_order_id
      AND assigned_source_account_id IS NOT NULL;

  -- 2. Count slots being deallocated
  SELECT COALESCE(SUM(quantity), 0) INTO v_deallocated_slots
    FROM order_items
    WHERE order_id = p_order_id
      AND assigned_source_account_id IS NOT NULL;

  -- 3. Clear all source assignments in one shot
  UPDATE order_items
    SET assigned_source_account_id = NULL
    WHERE order_id = p_order_id
      AND assigned_source_account_id IS NOT NULL;

  -- 4. Recalculate used_slots for each affected source account
  IF v_source_ids IS NOT NULL THEN
    UPDATE source_accounts sa
      SET used_slots = (
        SELECT COALESCE(SUM(oi.quantity), 0)
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE oi.assigned_source_account_id = sa.id
          AND o.deleted_at IS NULL
      ),
      updated_at = now()
    WHERE sa.id = ANY(v_source_ids)
      AND sa.account_id = p_account_id;
  END IF;

  -- 5. Release all license keys in one shot
  WITH released_keys AS (
    UPDATE license_keys
      SET status = 'available', order_id = NULL, assigned_at = NULL, updated_at = now()
      WHERE order_id = p_order_id AND status = 'used'
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deallocated_keys FROM released_keys;

  RETURN jsonb_build_object(
    'deallocated_slots', v_deallocated_slots,
    'deallocated_keys', v_deallocated_keys
  );
END;
$$;
