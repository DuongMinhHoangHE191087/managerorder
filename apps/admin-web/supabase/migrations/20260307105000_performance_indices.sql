-- Tối ưu hóa hiệu suất truy vấn cho các bảng chính
-- Tập trung vào các trường thường xuyên được sử dụng trong WHERE clause và JOIN

-- Kích hoạt extension hỗ trợ tìm kiếm text nâng cao (trigram)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Bảng Orders (Đơn hàng)
CREATE INDEX IF NOT EXISTS idx_orders_account_id ON orders(account_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- 2. Bảng Order Items (Chi tiết đơn hàng)
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- 3. Bảng Customers (Khách hàng)
CREATE INDEX IF NOT EXISTS idx_customers_account_id ON customers(account_id);
CREATE INDEX IF NOT EXISTS idx_customers_full_name_trgm ON customers USING gin (full_name gin_trgm_ops); -- Yêu cầu extension pg_trgm

-- 4. Bảng Products (Sản phẩm)
CREATE INDEX IF NOT EXISTS idx_products_account_id ON products(account_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);

-- 5. Bảng Calendar Events (Lịch nhắc nhở)
CREATE INDEX IF NOT EXISTS idx_reminder_events_account_id ON reminder_events(account_id);
CREATE INDEX IF NOT EXISTS idx_reminder_events_due_at ON reminder_events(due_at);
