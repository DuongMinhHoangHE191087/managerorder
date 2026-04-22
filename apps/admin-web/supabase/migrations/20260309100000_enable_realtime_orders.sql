-- Thêm bảng orders vào publication supabase_realtime để client có thể lắng nghe events
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
