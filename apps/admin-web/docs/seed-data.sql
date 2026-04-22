-- ============================================================
-- SEED DATA for Premium Admin Manager
-- Run in Supabase SQL Editor
-- Matches schema from supabase-v2-schema.sql
-- ============================================================

-- ============================================================
-- 1. CUSTOMERS (no account_id — matches v2 schema)
-- ============================================================
INSERT INTO customers (id, full_name, type, created_at)
VALUES
  ('a1b2c3d4-0001-4000-8000-000000000001', 'Nguyễn Văn Anh', 'retail', '2024-01-15T08:00:00Z'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'Trần Thị Bình', 'retail', '2024-02-20T10:30:00Z'),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'Lê Hoàng Long', 'wholesale', '2024-03-01T14:00:00Z'),
  ('a1b2c3d4-0004-4000-8000-000000000004', 'Phạm Minh Đức', 'retail', '2024-04-10T09:00:00Z'),
  ('a1b2c3d4-0005-4000-8000-000000000005', 'Hoàng Thùy Linh', 'agency', '2024-05-05T16:00:00Z'),
  ('a1b2c3d4-0006-4000-8000-000000000006', 'Võ Thanh Hải', 'retail', '2024-06-20T11:00:00Z'),
  ('a1b2c3d4-0007-4000-8000-000000000007', 'Đặng Thị Mai', 'wholesale', '2024-07-15T13:30:00Z'),
  ('a1b2c3d4-0008-4000-8000-000000000008', 'Bùi Quốc Toàn', 'agency', '2024-08-01T08:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. CUSTOMER CONTACTS (separate table)
-- ============================================================
INSERT INTO customer_contacts (customer_id, channel, value, is_verified)
VALUES
  -- Nguyễn Văn Anh
  ('a1b2c3d4-0001-4000-8000-000000000001', 'email', 'anh.nguyen@gmail.com', true),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'phone', '0901234567', true),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'zalo', '0901234567', false),
  -- Trần Thị Bình
  ('a1b2c3d4-0002-4000-8000-000000000002', 'email', 'binh.tran@outlook.com', true),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'facebook', 'fb.com/binh.tran', false),
  -- Lê Hoàng Long
  ('a1b2c3d4-0003-4000-8000-000000000003', 'phone', '0923456789', true),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'telegram', '@lehoanglong', false),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'email', 'long.le@yahoo.com', true),
  -- Phạm Minh Đức
  ('a1b2c3d4-0004-4000-8000-000000000004', 'phone', '0934567890', true),
  ('a1b2c3d4-0004-4000-8000-000000000004', 'email', 'duc.pham@gmail.com', false),
  -- Hoàng Thùy Linh
  ('a1b2c3d4-0005-4000-8000-000000000005', 'email', 'linh.hoang@gmail.com', true),
  ('a1b2c3d4-0005-4000-8000-000000000005', 'zalo', '0945678901', true),
  -- Võ Thanh Hải
  ('a1b2c3d4-0006-4000-8000-000000000006', 'phone', '0956789012', true),
  -- Đặng Thị Mai
  ('a1b2c3d4-0007-4000-8000-000000000007', 'facebook', 'fb.com/mai.dang', false),
  ('a1b2c3d4-0007-4000-8000-000000000007', 'phone', '0967890123', true),
  -- Bùi Quốc Toàn
  ('a1b2c3d4-0008-4000-8000-000000000008', 'email', 'toan.bui@gmail.com', true),
  ('a1b2c3d4-0008-4000-8000-000000000008', 'telegram', '@buiquoctoan', false);

-- ============================================================
-- 3. PAYMENT SOURCES (no account_id)
-- ============================================================
INSERT INTO payment_sources (name, icon)
VALUES
  ('MoMo', '💜'),
  ('MB Bank', '🏦'),
  ('Vietcombank', '🏦'),
  ('Techcombank', '🏦'),
  ('Tiền mặt', '💵')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 4. SALES CHANNELS (no account_id)
-- ============================================================
INSERT INTO sales_channels (name)
VALUES
  ('Facebook'),
  ('Zalo'),
  ('TikTok Shop'),
  ('Website'),
  ('Trực tiếp')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 5. INVENTORY ACCOUNTS
-- ============================================================
INSERT INTO inventory_accounts (id, email, password, profile_name, status, total_slots, used_slots, renewal_date, created_at)
VALUES
  ('b1b2c3d4-0001-4000-8000-000000000001', 'family1@duolingo-pool.com', 'encrypted_placeholder', 'Duolingo Family Pool 1', 'active', 6, 4, '2025-12-31T23:59:59Z', '2024-01-10T00:00:00Z'),
  ('b1b2c3d4-0002-4000-8000-000000000002', 'family2@duolingo-pool.com', 'encrypted_placeholder', 'Duolingo Family Pool 2', 'active', 6, 6, '2025-06-30T23:59:59Z', '2024-02-15T00:00:00Z'),
  ('b1b2c3d4-0003-4000-8000-000000000003', 'spotify.admin@pool.com', 'encrypted_placeholder', 'Spotify Premium Family', 'active', 6, 3, '2025-09-30T23:59:59Z', '2024-03-01T00:00:00Z'),
  ('b1b2c3d4-0004-4000-8000-000000000004', 'youtube.fam@pool.com', 'encrypted_placeholder', 'YouTube Premium Family', 'active', 5, 2, '2025-11-15T23:59:59Z', '2024-04-01T00:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 6. ORDERS
-- ============================================================
INSERT INTO orders (id, customer_id, status, payment_method, total_amount, total_paid, created_at, items)
VALUES
  ('c1b2c3d4-0001-4000-8000-000000000001', 'a1b2c3d4-0001-4000-8000-000000000001', 'completed', 'paid', 450000, 450000, '2024-01-20T10:00:00Z', '[{"productName":"Duolingo Family Plan","quantity":1,"price":450000}]'::jsonb),
  ('c1b2c3d4-0002-4000-8000-000000000002', 'a1b2c3d4-0002-4000-8000-000000000002', 'completed', 'paid', 59000, 59000, '2024-03-20T14:00:00Z', '[{"productName":"Spotify Premium","quantity":1,"price":59000}]'::jsonb),
  ('c1b2c3d4-0003-4000-8000-000000000003', 'a1b2c3d4-0003-4000-8000-000000000003', 'completed', 'paid', 450000, 450000, '2024-05-10T09:00:00Z', '[{"productName":"Duolingo Family Plan","quantity":1,"price":450000}]'::jsonb),
  ('c1b2c3d4-0004-4000-8000-000000000004', 'a1b2c3d4-0004-4000-8000-000000000004', 'pending', 'debt', 55000, 0, '2024-05-10T11:00:00Z', '[{"productName":"YouTube Premium","quantity":1,"price":55000}]'::jsonb),
  ('c1b2c3d4-0005-4000-8000-000000000005', 'a1b2c3d4-0005-4000-8000-000000000005', 'completed', 'paid', 380000, 380000, '2024-06-01T08:00:00Z', '[{"productName":"Canva Pro Team","quantity":1,"price":380000}]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 7. CALENDAR EVENTS
-- ============================================================
INSERT INTO calendar_events (id, title, event_type, start_time, customer_id, notes, created_at)
VALUES
  ('d1b2c3d4-0001-4000-8000-000000000001', 'Nhắc gia hạn Duolingo - Anh Nguyễn', 'renewal', '2025-12-25T09:00:00Z', 'a1b2c3d4-0001-4000-8000-000000000001', 'Gia hạn tài khoản Family Plan', '2024-06-01T00:00:00Z'),
  ('d1b2c3d4-0002-4000-8000-000000000002', 'Thu nợ Trần Thị Bình', 'reminder', '2025-04-01T10:00:00Z', 'a1b2c3d4-0002-4000-8000-000000000002', 'Nhắc thanh toán 150k VND', '2024-03-25T00:00:00Z'),
  ('d1b2c3d4-0003-4000-8000-000000000003', 'Gọi chăm sóc KH VIP - Lê Hoàng Long', 'follow_up', '2025-04-15T14:00:00Z', 'a1b2c3d4-0003-4000-8000-000000000003', 'Hỏi thăm và upsell gói mới', '2024-04-01T00:00:00Z'),
  ('d1b2c3d4-0004-4000-8000-000000000004', 'Kiểm tra Spotify hết hạn tháng 4', 'renewal', '2025-04-20T08:00:00Z', NULL, 'Batch check tất cả accounts', '2024-04-10T00:00:00Z'),
  ('d1b2c3d4-0005-4000-8000-000000000005', 'Nhắc thanh toán Phạm Minh Đức', 'reminder', '2025-05-01T09:00:00Z', 'a1b2c3d4-0004-4000-8000-000000000004', 'Nợ 55k tiền YouTube Premium', '2024-04-20T00:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 8. PROVIDERS TABLE (NEW - create if not exists)
-- ============================================================
CREATE TABLE IF NOT EXISTS providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  contacts JSONB DEFAULT '[]'::jsonb,
  type TEXT DEFAULT 'retail' CHECK (type IN ('retail', 'wholesale', 'agency')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE providers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'providers' AND policyname = 'Enable all for providers') THEN
    CREATE POLICY "Enable all for providers" ON providers FOR ALL USING (true);
  END IF;
END $$;

INSERT INTO providers (id, name, contacts, type, notes, created_at)
VALUES
  ('e1b2c3d4-0001-4000-8000-000000000001', 'Global Subs Co.', '[{"id":"pc_001","type":"email","value":"contact@globalsubs.com","isPrimary":true},{"id":"pc_002","type":"phone","value":"0901111222"}]'::jsonb, 'wholesale', 'Nhà cung cấp chính', '2024-01-05T00:00:00Z'),
  ('e1b2c3d4-0002-4000-8000-000000000002', 'Digital Keys VN', '[{"id":"pc_003","type":"email","value":"sales@digitalkeys.vn","isPrimary":true},{"id":"pc_004","type":"zalo","value":"0912222333"}]'::jsonb, 'retail', NULL, '2024-02-10T00:00:00Z'),
  ('e1b2c3d4-0003-4000-8000-000000000003', 'Bulk Reseller Corp', '[{"id":"pc_005","type":"telegram","value":"@bulkreseller","isPrimary":true}]'::jsonb, 'wholesale', 'Giá tốt volume lớn', '2024-03-01T00:00:00Z'),
  ('e1b2c3d4-0004-4000-8000-000000000004', 'Premium Direct', '[{"id":"pc_006","type":"facebook","value":"fb.com/premiumdirect","isPrimary":true},{"id":"pc_007","type":"phone","value":"0933444555"}]'::jsonb, 'agency', NULL, '2024-04-15T00:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- DONE! Verify:
-- SELECT count(*) AS customers FROM customers;
-- SELECT count(*) AS contacts FROM customer_contacts;
-- SELECT count(*) AS orders FROM orders;
-- SELECT count(*) AS events FROM calendar_events;
-- SELECT count(*) AS providers FROM providers;
-- ============================================================
