-- ============================================================
-- Migration: Atomic Order Creation + Order Code Index + Stats RPC
-- ============================================================

-- 1. RPC: Create order with items in a single transaction
CREATE OR REPLACE FUNCTION create_order_with_items(
  p_order jsonb,
  p_items jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id uuid;
  v_order_row orders%ROWTYPE;
  v_items jsonb;
BEGIN
  -- Insert order header
  INSERT INTO orders (
    account_id, order_code, customer_id, product_id,
    product_name_snapshot, unit_price_vnd, quantity,
    total_amount_vnd, total_paid, payment_method,
    payment_source_id, sales_channel_id, status,
    contact_snapshot, proof_image_urls, sales_note,
    expires_at, created_at, cost_price_vnd, total_cost_vnd,
    invoice_snapshot, billing_details
  )
  VALUES (
    (p_order->>'account_id')::uuid,
    p_order->>'order_code',
    (p_order->>'customer_id')::uuid,
    (p_order->>'product_id')::uuid,
    p_order->>'product_name_snapshot',
    (p_order->>'unit_price_vnd')::numeric,
    (p_order->>'quantity')::int,
    (p_order->>'total_amount_vnd')::numeric,
    (p_order->>'total_paid')::numeric,
    p_order->>'payment_method',
    NULLIF(p_order->>'payment_source_id', '')::uuid,
    NULLIF(p_order->>'sales_channel_id', '')::uuid,
    p_order->>'status',
    p_order->>'contact_snapshot',
    CASE
      WHEN p_order->'proof_image_urls' IS NOT NULL AND p_order->'proof_image_urls' != 'null'::jsonb
      THEN ARRAY(SELECT jsonb_array_elements_text(p_order->'proof_image_urls'))
      ELSE NULL
    END,
    p_order->>'sales_note',
    (p_order->>'expires_at')::timestamptz,
    COALESCE((p_order->>'created_at')::timestamptz, now()),
    (p_order->>'cost_price_vnd')::numeric,
    (p_order->>'total_cost_vnd')::numeric,
    CASE WHEN p_order->'invoice_snapshot' IS NOT NULL AND p_order->'invoice_snapshot' != 'null'::jsonb
      THEN p_order->'invoice_snapshot' ELSE NULL END,
    CASE WHEN p_order->'billing_details' IS NOT NULL AND p_order->'billing_details' != 'null'::jsonb
      THEN p_order->'billing_details' ELSE NULL END
  )
  RETURNING id INTO v_order_id;

  -- Insert order items
  INSERT INTO order_items (
    order_id, product_id, product_name_snapshot,
    quantity, price_vnd, cost_price_vnd, subtotal_vnd,
    notes, assigned_source_account_id, customer_nick_used
  )
  SELECT
    v_order_id,
    (item->>'product_id')::uuid,
    item->>'product_name_snapshot',
    (item->>'quantity')::int,
    (item->>'price_vnd')::numeric,
    (item->>'cost_price_vnd')::numeric,
    (item->>'subtotal_vnd')::numeric,
    item->>'notes',
    NULLIF(item->>'assigned_source_account_id', '')::uuid,
    item->>'customer_nick_used'
  FROM jsonb_array_elements(p_items) AS item;

  -- Fetch the complete order row
  SELECT * INTO v_order_row FROM orders WHERE id = v_order_id;

  -- Fetch inserted items
  SELECT jsonb_agg(row_to_json(oi)) INTO v_items
  FROM order_items oi WHERE oi.order_id = v_order_id;

  -- Return both order and items as JSON
  RETURN jsonb_build_object(
    'order', row_to_json(v_order_row),
    'items', COALESCE(v_items, '[]'::jsonb)
  );
END;
$$;

-- 2. Unique index for order_code (prevents collision)
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_code
  ON orders(order_code)
  WHERE deleted_at IS NULL AND order_code IS NOT NULL;

-- 3. RPC: Get order stats via DB-level aggregation (Phase 5)
CREATE OR REPLACE FUNCTION get_order_stats(
  p_account_id uuid,
  p_status text DEFAULT NULL,
  p_customer_id uuid DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL
) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT jsonb_build_object(
    'total_orders', COUNT(*)::int,
    'total_revenue', COALESCE(SUM(total_amount_vnd), 0)::numeric,
    'total_cost', COALESCE(SUM(total_cost_vnd), 0)::numeric,
    'total_profit', (COALESCE(SUM(total_amount_vnd), 0) - COALESCE(SUM(total_cost_vnd), 0))::numeric,
    'total_paid_amount', COALESCE(SUM(total_paid), 0)::numeric,
    'total_debt', (COALESCE(SUM(total_amount_vnd), 0) - COALESCE(SUM(total_paid), 0))::numeric,
    'pending_count', COUNT(*) FILTER (WHERE status = 'pending_payment')::int,
    'active_count', COUNT(*) FILTER (WHERE status = 'active')::int,
    'paid_count', COUNT(*) FILTER (WHERE status = 'paid')::int,
    'expired_count', COUNT(*) FILTER (WHERE status = 'expired')::int
  )
  FROM orders
  WHERE account_id = p_account_id
    AND deleted_at IS NULL
    AND (p_status IS NULL OR status = p_status)
    AND (p_customer_id IS NULL OR customer_id = p_customer_id)
    AND (p_date_from IS NULL OR created_at >= p_date_from)
    AND (p_date_to IS NULL OR created_at < p_date_to);
$$;
