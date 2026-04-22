-- Migration: Add customer_nick_used column to order_items
-- This column stores the Duolingo username / email used by the customer
-- for smart matching with source accounts (inventory allocation)

ALTER TABLE "public"."order_items"
ADD COLUMN IF NOT EXISTS "customer_nick_used" text;

-- Add index for faster matching queries in scanSmartMatches and allocation service
CREATE INDEX IF NOT EXISTS "idx_order_items_customer_nick_used"
ON "public"."order_items" ("customer_nick_used")
WHERE "customer_nick_used" IS NOT NULL;
