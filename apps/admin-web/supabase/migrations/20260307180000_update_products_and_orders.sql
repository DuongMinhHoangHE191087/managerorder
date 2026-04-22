-- Migration: Add duration setup and cost snapshot pricing 

-- 1. PRODUCTS TABLE
ALTER TABLE "public"."products" 
ADD COLUMN "duration_type" text NOT NULL DEFAULT 'days' CHECK ("duration_type" IN ('days', 'months', 'years')),
ADD COLUMN "duration_value" integer NOT NULL DEFAULT 0;

-- Convert existing duration_days
UPDATE "public"."products"
SET "duration_value" = "duration_days",
    "duration_type" = 'days'
WHERE "duration_days" IS NOT NULL;

-- Smart convert known durations
UPDATE "public"."products" SET "duration_value" = 6, "duration_type" = 'months' WHERE "duration_days" IN (180, 182, 183);
UPDATE "public"."products" SET "duration_value" = 1, "duration_type" = 'years' WHERE "duration_days" IN (365, 366);
UPDATE "public"."products" SET "duration_value" = 3, "duration_type" = 'months' WHERE "duration_days" = 90;
UPDATE "public"."products" SET "duration_value" = 1, "duration_type" = 'months' WHERE "duration_days" = 30;

-- Drop duration_days
ALTER TABLE "public"."products" DROP COLUMN "duration_days";


-- 2. ORDERS & ORDER ITEMS TABLES
ALTER TABLE "public"."order_items"
ADD COLUMN "cost_price_vnd" numeric;

ALTER TABLE "public"."orders"
ADD COLUMN "cost_price_vnd" numeric,
ADD COLUMN "total_cost_vnd" numeric;

-- Backfill data based on current buy_price_vnd from products
UPDATE "public"."order_items" oi
SET "cost_price_vnd" = p.buy_price_vnd
FROM "public"."products" p
WHERE oi.product_id = p.id;

UPDATE "public"."orders" o
SET "cost_price_vnd" = p.buy_price_vnd,
    "total_cost_vnd" = p.buy_price_vnd * o.quantity
FROM "public"."products" p
WHERE o.product_id = p.id AND o.product_id IS NOT NULL;
