import { describe, expect, it } from "vitest";
import type { ProductService } from "@/lib/domain/types";
import {
  DEFAULT_SALES_LANDING_CONFIG,
  buildSalesLandingConfigFromProducts,
  buildSalesLandingOffers,
  formatMarketingPrice,
  normalizeSalesLandingConfig,
} from "@/lib/settings/sales-landing";

describe("sales landing settings", () => {
  it("fills missing slots with defaults", () => {
    const normalized = normalizeSalesLandingConfig({
      offers: [{ href: "https://example.com", label: "Custom" }],
    });

    expect(normalized.offers).toHaveLength(4);
    expect(normalized.offers[0].label).toBe("Custom");
    expect(normalized.offers[0].href).toBe("https://example.com");
    expect(normalized.offers[1].label).toBe(DEFAULT_SALES_LANDING_CONFIG.offers[1].label);
  });

  it("builds renderable offers with default styles and custom href", () => {
    const offers = buildSalesLandingOffers({
      offers: DEFAULT_SALES_LANDING_CONFIG.offers.map((offer, index) => ({
        ...offer,
        href: `https://example.com/${index}`,
      })),
    });

    expect(offers).toHaveLength(4);
    expect(offers[0].href).toBe("https://example.com/0");
    expect(offers[0].label).toBe(DEFAULT_SALES_LANDING_CONFIG.offers[0].label);
  });

  it("hydrates product snapshots for landing cards", () => {
    const products: ProductService[] = [
      {
        id: "prod_1",
        name: "Netflix 1 tháng",
        mode: "slot",
        buyPriceVnd: 50000,
        sellPriceVnd: 88000,
        durationType: "months",
        durationValue: 1,
        isActive: true,
      },
    ];

    const config = buildSalesLandingConfigFromProducts(products, {
      offers: [
        {
          product_id: "prod_1",
          href: "https://example.com/netflix",
          label: "Old label",
          price: "Old price",
          desc: "Old desc",
        },
      ],
    });

    expect(config.offers[0].label).toBe("Netflix 1 tháng");
    expect(config.offers[0].price).toBe("88k/tháng");
    expect(config.offers[0].href).toBe("https://example.com/netflix");
  });

  it("formats marketing price labels", () => {
    expect(formatMarketingPrice(88000, 1, "months")).toBe("88k/tháng");
    expect(formatMarketingPrice(123000)).toBe("123k");
  });
});
