import type {
  ProductService,
  SalesLandingConfig,
  SalesLandingOfferConfig,
  ShortLinkFailureTemplateKey,
} from "@/lib/domain/types";
import { PREMIUM_OFFERS, type OfferCard } from "@/widgets/marketing/sales-landing-config";

const DEFAULT_OFFER_CONFIGS: SalesLandingOfferConfig[] = PREMIUM_OFFERS.map((offer) => ({
  product_id: null,
  href: offer.href,
  label: offer.label,
  price: offer.price,
  desc: offer.desc,
}));

export const DEFAULT_SALES_LANDING_CONFIG: SalesLandingConfig = {
  offers: DEFAULT_OFFER_CONFIGS,
  shortLinkFailureDefaults: {
    defaultTemplateKey: "customer_offer_wall",
    customerOfferCtaHref: "https://duongminhhoang.store",
    sellerUnlockMessage: "Link này đã hết hạn. Hãy gửi yêu cầu đến người bán để mở lại.",
  },
};

export function normalizeSalesLandingConfig(
  value?: Partial<SalesLandingConfig> | Record<string, unknown> | null
): SalesLandingConfig {
  const offers = extractOffers(value);

  const normalizedOffers = offers.length > 0
    ? offers.map((offer, index) => {
        const fallback = DEFAULT_OFFER_CONFIGS[index % DEFAULT_OFFER_CONFIGS.length] || DEFAULT_OFFER_CONFIGS[0];
        return normalizeOffer(offer, fallback, index);
      })
    : DEFAULT_OFFER_CONFIGS;

  return {
    offers: normalizedOffers,
    shortLinkFailureDefaults: normalizeShortLinkFailureDefaults(value),
  };
}

export function buildSalesLandingOffers(
  config?: Partial<SalesLandingConfig> | Record<string, unknown> | null
): OfferCard[] {
  const normalized = normalizeSalesLandingConfig(config);

  return normalized.offers.map((offer, index) => {
    const style = PREMIUM_OFFERS[index % PREMIUM_OFFERS.length] || PREMIUM_OFFERS[0];
    return {
      icon: style.icon,
      gradient: style.gradient,
      tag: style.tag,
      href: offer.href || style.href,
      label: offer.label || style.label,
      price: offer.price || style.price,
      desc: offer.desc || style.desc,
    };
  });
}

export function buildSalesLandingConfigFromProducts(
  products: ProductService[],
  current?: Partial<SalesLandingConfig> | Record<string, unknown> | null
): SalesLandingConfig {
  const normalized = normalizeSalesLandingConfig(current);
  const productMap = new Map(products.map((product) => [product.id, product]));

  return {
    offers: normalized.offers.map((offer, index) => {
      const product = offer.product_id ? productMap.get(offer.product_id) : null;
      if (!product) {
        return offer;
      }

      return {
        ...offer,
        product_id: product.id,
        label: product.name,
        price: formatMarketingPrice(product.sellPriceVnd, product.durationValue, product.durationType),
        desc: offer.desc || (DEFAULT_OFFER_CONFIGS[index % DEFAULT_OFFER_CONFIGS.length]?.desc ?? DEFAULT_OFFER_CONFIGS[0].desc),
      };
    }),
    shortLinkFailureDefaults: normalized.shortLinkFailureDefaults,
  };
}

export function formatMarketingPrice(
  amountVnd: number | null | undefined,
  durationValue?: number | null,
  durationType?: ProductService["durationType"] | null
): string {
  if (!amountVnd || amountVnd <= 0 || !Number.isFinite(amountVnd)) {
    return "Liên hệ";
  }

  const compact = amountVnd >= 1_000_000 ? formatLargeVnd(amountVnd) : `${Math.round(amountVnd / 1000)}k`;
  const duration = formatDurationLabel(durationValue ?? null, durationType ?? null);
  return duration ? `${compact}/${duration}` : compact;
}

function formatLargeVnd(amountVnd: number): string {
  const millions = amountVnd / 1_000_000;
  const rounded = millions >= 10 ? Math.round(millions) : Number(millions.toFixed(1));
  return `${String(rounded).replace(/\.0$/, "")}tr`;
}

function formatDurationLabel(
  durationValue: number | null,
  durationType: ProductService["durationType"] | null
): string | null {
  if (!durationType) return null;

  const normalizedValue = Number(durationValue ?? 0) || 0;
  if (durationType === "days") {
    return normalizedValue > 1 ? `${normalizedValue} ngày` : "ngày";
  }
  if (durationType === "months") {
    return normalizedValue > 1 ? `${normalizedValue} tháng` : "tháng";
  }

  return normalizedValue > 1 ? `${normalizedValue} năm` : "năm";
}

function extractOffers(
  value?: Partial<SalesLandingConfig> | Record<string, unknown> | null
): Array<Partial<SalesLandingOfferConfig> | Record<string, unknown>> {
  const rawOffers = value && typeof value === "object" ? (value as Record<string, unknown>).offers : null;
  if (!Array.isArray(rawOffers)) {
    return [];
  }

  return rawOffers as Array<Partial<SalesLandingOfferConfig> | Record<string, unknown>>;
}

function normalizeShortLinkFailureDefaults(
  value?: Partial<SalesLandingConfig> | Record<string, unknown> | null
): SalesLandingConfig["shortLinkFailureDefaults"] {
  const raw =
    value && typeof value === "object"
      ? (value as Record<string, unknown>).shortLinkFailureDefaults
      : null;
  const config = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};

  return {
    defaultTemplateKey: normalizeFailureTemplateKey(config.defaultTemplateKey),
    customerOfferCtaHref: normalizeUrl(
      config.customerOfferCtaHref,
      DEFAULT_SALES_LANDING_CONFIG.shortLinkFailureDefaults.customerOfferCtaHref,
    ),
    sellerUnlockMessage:
      normalizeString(config.sellerUnlockMessage)
      || DEFAULT_SALES_LANDING_CONFIG.shortLinkFailureDefaults.sellerUnlockMessage,
  };
}

function normalizeFailureTemplateKey(value: unknown): ShortLinkFailureTemplateKey {
  return value === "seller_unlock_request" || value === "customer_offer_wall"
    ? value
    : DEFAULT_SALES_LANDING_CONFIG.shortLinkFailureDefaults.defaultTemplateKey;
}

function normalizeOffer(
  value: Partial<SalesLandingOfferConfig> | Record<string, unknown> | undefined,
  fallback: SalesLandingOfferConfig,
  index: number
): SalesLandingOfferConfig {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const label = normalizeString(raw.label ?? fallback.label ?? PREMIUM_OFFERS[index].label);
  const price = normalizeString(raw.price ?? fallback.price ?? PREMIUM_OFFERS[index].price);
  const desc = normalizeString(raw.desc ?? fallback.desc ?? PREMIUM_OFFERS[index].desc);

  return {
    product_id: normalizeOptionalString(raw.product_id ?? fallback.product_id),
    href: normalizeString(raw.href ?? fallback.href),
    label,
    price,
    desc,
  };
}

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeUrl(value: unknown, fallback: string): string {
  const normalized = normalizeString(value);
  if (!normalized) {
    return fallback;
  }

  try {
    return new URL(normalized).toString();
  } catch {
    return fallback;
  }
}

function normalizeOptionalString(value: unknown): string | null {
  const normalized = normalizeString(value);
  return normalized || null;
}
