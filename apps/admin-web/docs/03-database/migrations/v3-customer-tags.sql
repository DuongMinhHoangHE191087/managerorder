-- ==========================================
-- V3 Migration: Customer Tags & Duplicate Detection Indexes
-- Run this on Supabase SQL Editor
-- ==========================================

-- 1. Customer Tags table
CREATE TABLE IF NOT EXISTS customer_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL,
  name VARCHAR(50) NOT NULL,
  color VARCHAR(7) NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, name)
);

-- 2. Customer Tag Assignments (pivot table)
CREATE TABLE IF NOT EXISTS customer_tag_assignments (
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES customer_tags(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (customer_id, tag_id)
);

-- 3. Index for contact value duplicate detection
CREATE INDEX IF NOT EXISTS idx_customer_contacts_value_lower 
  ON customer_contacts (lower(value));

-- 4. Performance indexes for tags
CREATE INDEX IF NOT EXISTS idx_customer_tags_account_id ON customer_tags(account_id);
CREATE INDEX IF NOT EXISTS idx_customer_tag_assignments_customer ON customer_tag_assignments(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_tag_assignments_tag ON customer_tag_assignments(tag_id);

-- 5. RLS
ALTER TABLE customer_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_tag_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY full_access ON customer_tags FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY full_access ON customer_tag_assignments FOR ALL USING (auth.role() = 'authenticated');

-- 6. Trigger for updated_at (tags don't need it since no update, but good practice)
-- customer_tags are immutable (create/delete only), no trigger needed.

-- ==========================================
-- DONE! V3 Customer Tags migration complete.
-- ==========================================
