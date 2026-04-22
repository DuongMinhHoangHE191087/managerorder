-- Tạo cột qr_transfer_content trong bảng system_settings
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS qr_transfer_content text;
