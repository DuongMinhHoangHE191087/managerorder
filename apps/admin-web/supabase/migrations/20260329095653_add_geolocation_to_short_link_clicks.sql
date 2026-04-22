-- Migration to add geolocation columns to short_link_clicks table

ALTER TABLE "public"."short_link_clicks"
ADD COLUMN IF NOT EXISTS "city" text,
ADD COLUMN IF NOT EXISTS "country_region" text,
ADD COLUMN IF NOT EXISTS "ip_version" text;
