-- ============================================================
-- SQL VALIDATION SCRIPTS — Inventory Module
--
-- Run manually against Supabase/Postgres to verify data integrity.
-- Each query returns violations; empty result = PASS.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Orphan License Keys (no matching product)
-- ─────────────────────────────────────────────────────────────
SELECT lk.id AS license_key_id,
       lk.product_id,
       lk.status
FROM   license_keys lk
LEFT JOIN products p ON p.id = lk.product_id
WHERE  p.id IS NULL;
-- Expected: 0 rows


-- ─────────────────────────────────────────────────────────────
-- 2. Source Account Slot Overflow (used_slots > max_slots)
-- ─────────────────────────────────────────────────────────────
SELECT id AS source_account_id,
       email,
       used_slots,
       max_slots,
       (used_slots - max_slots) AS overflow
FROM   source_accounts
WHERE  used_slots > max_slots;
-- Expected: 0 rows


-- ─────────────────────────────────────────────────────────────
-- 3. Negative Slot Count
-- ─────────────────────────────────────────────────────────────
SELECT id, email, used_slots
FROM   source_accounts
WHERE  used_slots < 0;
-- Expected: 0 rows


-- ─────────────────────────────────────────────────────────────
-- 4. Used/Reserved Keys Without Order ID
-- ─────────────────────────────────────────────────────────────
SELECT id, status, order_id, product_id
FROM   license_keys
WHERE  status IN ('used', 'reserved')
  AND  order_id IS NULL;
-- Expected: 0 rows


-- ─────────────────────────────────────────────────────────────
-- 5. Available Keys WITH Order ID (stale assignment)
-- ─────────────────────────────────────────────────────────────
SELECT id, status, order_id, product_id
FROM   license_keys
WHERE  status = 'available'
  AND  order_id IS NOT NULL;
-- Expected: 0 rows


-- ─────────────────────────────────────────────────────────────
-- 6. Source Account used_slots Mismatch vs Order Items
-- ─────────────────────────────────────────────────────────────
WITH slot_calc AS (
   SELECT assigned_source_account_id AS source_id,
          SUM(quantity) AS calculated_used
   FROM   order_items
   WHERE  assigned_source_account_id IS NOT NULL
   GROUP BY assigned_source_account_id
)
SELECT sa.id,
       sa.email,
       sa.used_slots AS recorded,
       COALESCE(sc.calculated_used, 0) AS calculated,
       sa.used_slots - COALESCE(sc.calculated_used, 0) AS drift
FROM   source_accounts sa
LEFT JOIN slot_calc sc ON sc.source_id = sa.id
WHERE  sa.used_slots != COALESCE(sc.calculated_used, 0);
-- Expected: 0 rows (or investigate drift)


-- ─────────────────────────────────────────────────────────────
-- 7. Expired Source Accounts with Available Keys
-- ─────────────────────────────────────────────────────────────
SELECT lk.id AS license_key_id,
       lk.status,
       sa.id AS source_account_id,
       sa.email,
       sa.expires_at
FROM   license_keys lk
JOIN   source_accounts sa ON sa.id = lk.source_account_id
WHERE  sa.expires_at < NOW()
  AND  lk.status = 'available';
-- Expected: 0 rows (expired accounts should not have available keys)


-- ─────────────────────────────────────────────────────────────
-- 8. Duplicate Key Values (same key_value per product)
-- ─────────────────────────────────────────────────────────────
SELECT product_id,
       key_value,
       COUNT(*) AS duplicate_count
FROM   license_keys
WHERE  key_value IS NOT NULL
GROUP BY product_id, key_value
HAVING COUNT(*) > 1;
-- Expected: 0 rows


-- ─────────────────────────────────────────────────────────────
-- 9. Orders in 'provisioning' Status > 30 Minutes (stuck)
-- ─────────────────────────────────────────────────────────────
SELECT id, status, updated_at
FROM   orders
WHERE  status = 'provisioning'
  AND  updated_at < NOW() - INTERVAL '30 minutes';
-- Expected: 0 rows (indicates stuck allocation process)


-- ─────────────────────────────────────────────────────────────
-- 10. Summary Health Check
-- ─────────────────────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM license_keys) AS total_keys,
  (SELECT COUNT(*) FROM license_keys WHERE status = 'available') AS available_keys,
  (SELECT COUNT(*) FROM license_keys WHERE status = 'used') AS used_keys,
  (SELECT COUNT(*) FROM source_accounts) AS total_accounts,
  (SELECT COUNT(*) FROM source_accounts WHERE used_slots > max_slots) AS overflow_accounts,
  (SELECT COUNT(*) FROM source_accounts WHERE used_slots < 0) AS negative_accounts,
  (SELECT COUNT(*) FROM source_accounts WHERE expires_at < NOW()) AS expired_accounts;
