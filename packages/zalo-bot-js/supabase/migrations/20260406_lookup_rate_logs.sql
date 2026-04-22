-- Migration: Tạo bảng lookup_rate_logs để rate-limit tra cứu đơn hàng
-- Mỗi Zalo ID chỉ được tra cứu tối đa N lần/ngày

CREATE TABLE IF NOT EXISTS lookup_rate_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id  TEXT NOT NULL,
    zalo_user_id TEXT NOT NULL,
    keyword_masked TEXT,          -- Keyword đã mask (bảo vệ privacy)
    query_date  DATE NOT NULL,    -- Ngày tra cứu (dùng để đếm)
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index để query nhanh theo (account_id, zalo_user_id, query_date)
CREATE INDEX IF NOT EXISTS idx_rate_logs_lookup
    ON lookup_rate_logs (account_id, zalo_user_id, query_date);

-- RLS Policy: Chỉ backend service (service_role) mới được ghi
ALTER TABLE lookup_rate_logs ENABLE ROW LEVEL SECURITY;

-- Cho phép service role đọc/ghi toàn bộ
CREATE POLICY "Service role full access"
    ON lookup_rate_logs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Tự động xóa log cũ hơn 7 ngày (optional, dùng pg_cron nếu cần)
-- Hoặc chạy thủ công: DELETE FROM lookup_rate_logs WHERE query_date < NOW() - INTERVAL '7 days';
