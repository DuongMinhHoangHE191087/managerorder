-- ==========================================
-- FULL SETUP: PREMIUM ADMIN V2 SCHEMA
-- STEP 1: Run this first to clean up old tables
-- STEP 2: Script auto-creates all new tables
-- !! Safe to run multiple times (IF NOT EXISTS) !!
-- ==========================================

-- 0. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- STEP 1: DROP OLD CONFLICTING TABLES
-- (Safe - only drops tables from old v1 schema)
-- These tables are from the OLD schema and must be
-- removed before recreating with the new structure.
-- ==========================================

DROP TABLE IF EXISTS calendar_events CASCADE;
DROP TABLE IF EXISTS inventory_accounts CASCADE;

-- Drop old orders first (has FK to old customers)
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;

-- Drop old customer tables
DROP TABLE IF EXISTS customer_contacts CASCADE;
DROP TABLE IF EXISTS customers CASCADE;

-- Drop old infra tables
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS providers CASCADE;
DROP TABLE IF EXISTS license_keys CASCADE;
DROP TABLE IF EXISTS source_accounts CASCADE;
DROP TABLE IF EXISTS reminder_events CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS admin_users CASCADE;

-- Drop old payment/channels (old version had no account_id)
DROP TABLE IF EXISTS payment_sources CASCADE;
DROP TABLE IF EXISTS sales_channels CASCADE;

-- ==========================================
-- STEP 2: Utility function
-- ==========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ==========================================
-- STEP 3: CREATE ALL NEW TABLES
-- (All tables include account_id as plain UUID,
--  NO foreign key to premium_accounts)
-- ==========================================

-- Admin Users
CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    first_name TEXT NOT NULL DEFAULT '',
    last_name TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'staff', 'viewer')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'invited')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL,
    name TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'slot' CHECK (mode IN ('slot', 'key', 'hybrid')),
    duration_days INTEGER NOT NULL DEFAULT 30,
    buy_price_vnd NUMERIC NOT NULL DEFAULT 0,
    sell_price_vnd NUMERIC NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customers
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL,
    full_name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'retail' CHECK (type IN ('retail', 'wholesale', 'agency')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customer Contacts
CREATE TABLE customer_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    channel TEXT NOT NULL CHECK (channel IN ('phone', 'email', 'zalo', 'facebook', 'telegram', 'other')),
    value TEXT NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customer_contacts_customer_id ON customer_contacts(customer_id);

-- Providers
CREATE TABLE providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL,
    name TEXT NOT NULL,
    contacts JSONB DEFAULT '[]'::jsonb,
    tier TEXT NOT NULL DEFAULT 'regular' CHECK (tier IN ('regular', 'vip')),
    reliability_score NUMERIC DEFAULT 5.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment Sources
CREATE TABLE payment_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL,
    name TEXT NOT NULL,
    icon TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sales Channels
CREATE TABLE sales_channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id),
    product_id UUID REFERENCES products(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price_vnd NUMERIC,
    product_name_snapshot TEXT,
    total_amount_vnd NUMERIC NOT NULL DEFAULT 0,
    total_paid NUMERIC NOT NULL DEFAULT 0,
    payment_method TEXT,
    payment_source_id UUID REFERENCES payment_sources(id),
    sales_channel_id UUID REFERENCES sales_channels(id),
    status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('draft','pending_payment','paid','provisioning','active','expired','refunded')),
    contact_snapshot TEXT,
    proof_image_urls TEXT[],
    sales_note TEXT,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    invoice_snapshot JSONB,
    billing_details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT check_items_is_array CHECK (jsonb_typeof(items) = 'array')
);

-- Order Items
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    product_name_snapshot TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    price_vnd NUMERIC NOT NULL DEFAULT 0,
    subtotal_vnd NUMERIC NOT NULL DEFAULT 0,
    notes TEXT,
    assigned_source_account_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- License Keys
CREATE TABLE license_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL,
    key_code TEXT NOT NULL UNIQUE,
    product_id UUID NOT NULL REFERENCES products(id),
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'used', 'expired', 'invalid')),
    order_id UUID REFERENCES orders(id),
    assigned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Source Accounts (Inventory)
CREATE TABLE source_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL,
    email TEXT NOT NULL,
    provider TEXT NOT NULL,
    max_slots INTEGER NOT NULL DEFAULT 5,
    used_slots INTEGER NOT NULL DEFAULT 0,
    product_ids UUID[] DEFAULT '{}',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reminder Events (Calendar)
-- type values match EventCreateModal: reminder, renewal, follow_up, meeting, payment, debt
CREATE TABLE reminder_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL,
    title TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'reminder' CHECK (type IN ('reminder', 'renewal', 'follow_up', 'meeting', 'payment', 'debt')),
    due_at TIMESTAMPTZ NOT NULL,
    is_done BOOLEAN DEFAULT FALSE,
    notes TEXT,
    customer_id UUID,
    has_reminder BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- System Settings
CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL UNIQUE,
    company_name TEXT NOT NULL DEFAULT '',
    tax_id TEXT NOT NULL DEFAULT '',
    company_address TEXT NOT NULL DEFAULT '',
    personal_name TEXT NOT NULL DEFAULT '',
    bank_name TEXT NOT NULL DEFAULT 'MB Bank',
    bank_account TEXT NOT NULL DEFAULT '',
    default_notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- STEP 4: ROW LEVEL SECURITY (all open for service key)
-- ==========================================

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY full_access ON products FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY full_access ON customers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY full_access ON customer_contacts FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY full_access ON providers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY full_access ON payment_sources FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY full_access ON sales_channels FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY full_access ON orders FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY full_access ON order_items FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY full_access ON license_keys FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY full_access ON source_accounts FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY full_access ON reminder_events FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY full_access ON system_settings FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY full_access ON admin_users FOR ALL USING (auth.role() = 'authenticated');

-- ==========================================
-- STEP 5: TRIGGERS (auto-update updated_at)
-- ==========================================

CREATE TRIGGER update_products_modtime BEFORE UPDATE ON products FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_customers_modtime BEFORE UPDATE ON customers FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_providers_modtime BEFORE UPDATE ON providers FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_orders_modtime BEFORE UPDATE ON orders FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_source_accounts_modtime BEFORE UPDATE ON source_accounts FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_reminder_events_modtime BEFORE UPDATE ON reminder_events FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_system_settings_modtime BEFORE UPDATE ON system_settings FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_admin_users_modtime BEFORE UPDATE ON admin_users FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ==========================================
-- DONE! Schema setup complete.
-- ==========================================
