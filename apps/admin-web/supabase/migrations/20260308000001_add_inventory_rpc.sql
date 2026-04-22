-- Atomically increment or decrement used_slots for a source account
-- Checks for capacity to prevent over-allocation.
CREATE OR REPLACE FUNCTION increment_source_account_slots(
  p_account_id UUID,
  p_source_id UUID,
  p_quantity INT
) RETURNS JSONB AS $$
DECLARE
  v_used INT;
  v_max INT;
BEGIN
  -- Lock the row for update
  SELECT used_slots, max_slots 
  INTO v_used, v_max 
  FROM source_accounts 
  WHERE id = p_source_id AND account_id = p_account_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source account not found';
  END IF;

  IF v_used + p_quantity > v_max THEN
    RAISE EXCEPTION 'Not enough slots available in this source account';
  END IF;

  IF v_used + p_quantity < 0 THEN
    RAISE EXCEPTION 'Cannot reduce used slots below 0';
  END IF;

  UPDATE source_accounts
  SET used_slots = used_slots + p_quantity,
      updated_at = NOW()
  WHERE id = p_source_id;

  RETURN jsonb_build_object(
    'success', true, 
    'source_id', p_source_id,
    'new_used_slots', v_used + p_quantity
  );
END;
$$ LANGUAGE plpgsql;

-- Atomically allocate N available license keys to an order
CREATE OR REPLACE FUNCTION allocate_license_keys(
  p_account_id UUID,
  p_product_id UUID,
  p_order_id UUID,
  p_quantity INT
) RETURNS JSONB AS $$
DECLARE
  v_allocated_count INT;
  v_allocated_ids UUID[];
BEGIN
  -- Attempt to lock and update the required number of available keys
  WITH locked_keys AS (
    SELECT id
    FROM license_keys
    WHERE account_id = p_account_id
      AND product_id = p_product_id
      AND status = 'available'
    ORDER BY created_at ASC
    LIMIT p_quantity
    FOR UPDATE SKIP LOCKED
  ),
  updated_keys AS (
    UPDATE license_keys
    SET status = 'used',
        order_id = p_order_id,
        assigned_at = NOW(),
        updated_at = NOW()
    FROM locked_keys
    WHERE license_keys.id = locked_keys.id
    RETURNING license_keys.id
  )
  SELECT count(*), array_agg(id) 
  INTO v_allocated_count, v_allocated_ids
  FROM updated_keys;

  IF v_allocated_count < p_quantity THEN
    RAISE EXCEPTION 'Not enough available license keys (requested %, found %)', p_quantity, v_allocated_count;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'allocated_count', v_allocated_count,
    'allocated_ids', v_allocated_ids
  );
END;
$$ LANGUAGE plpgsql;

