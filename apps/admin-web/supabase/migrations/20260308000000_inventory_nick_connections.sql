-- Migration: Add inventory nick connections support
-- Created: 2026-03-08 00:00:00

-- 1. Add customer_nick_used to order_items
ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS customer_nick_used text;

-- 2. Add nicks_registry to customers
-- Format: [{ "nick": "username/email/phone", "type": "e.g netflix, spotify", "notes": "...", "matched_source_id": "uuid or null" }]
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS nicks_registry jsonb DEFAULT '[]'::jsonb;
