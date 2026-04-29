-- Short-link public failure templates and seller contact overrides.

ALTER TABLE public.short_links
  ADD COLUMN IF NOT EXISTS failure_template_key TEXT NULL
    CHECK (failure_template_key IN ('seller_unlock_request', 'customer_offer_wall')),
  ADD COLUMN IF NOT EXISTS seller_contact_url TEXT NULL;

ALTER TABLE public.sales_channels
  ADD COLUMN IF NOT EXISTS default_failure_template_key TEXT NOT NULL DEFAULT 'customer_offer_wall'
    CHECK (default_failure_template_key IN ('seller_unlock_request', 'customer_offer_wall')),
  ADD COLUMN IF NOT EXISTS seller_contact_url TEXT NULL;

UPDATE public.sales_channels
SET default_failure_template_key = 'customer_offer_wall'
WHERE default_failure_template_key IS NULL;

COMMENT ON COLUMN public.short_links.failure_template_key IS
  'Optional per-link override for public failure view: seller_unlock_request or customer_offer_wall.';
COMMENT ON COLUMN public.short_links.seller_contact_url IS
  'Optional per-link seller contact URL used by seller_unlock_request.';
COMMENT ON COLUMN public.sales_channels.default_failure_template_key IS
  'Default failure template for short-links attached to this sales channel.';
COMMENT ON COLUMN public.sales_channels.seller_contact_url IS
  'Default seller contact URL inherited by short-links in this sales channel.';
