import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTestRequest,
  mockWithAccount,
  mockWithErrorHandler,
} from "./helpers/setup";

vi.mock("@/lib/api/with-account", () => mockWithAccount());
vi.mock("@/lib/api/with-error-handler", () => mockWithErrorHandler());
vi.mock("@/domains/short-links", () => ({
  createShortLinkForAccount: vi.fn(),
  deleteShortLink: vi.fn(),
  getShortLinkDetailForAccount: vi.fn(),
  listShortLinksForAccount: vi.fn(),
  updateShortLinkForAccount: vi.fn(),
}));
vi.mock("@/lib/services/fraud-detector", () => ({
  getClickAnalytics: vi.fn(),
}));

import {
  createShortLinkForAccount,
  deleteShortLink,
  getShortLinkDetailForAccount,
  listShortLinksForAccount,
  updateShortLinkForAccount,
} from "@/domains/short-links";
import { getClickAnalytics } from "@/lib/services/fraud-detector";
import { GET as listShortLinks, POST as createShortLink } from "@/app/api/short-links/route";
import {
  DELETE as deleteShortLinkRoute,
  GET as getShortLinkDetail,
  PATCH as updateShortLink,
} from "@/app/api/short-links/[id]/route";

describe("GET /api/short-links", () => {
  it("returns the account short-link list", async () => {
    vi.mocked(listShortLinksForAccount).mockResolvedValue([
      { id: "link-1", slug: "abcd1234" } as never,
    ]);

    const response = await listShortLinks(
      createTestRequest("http://localhost/api/short-links"),
      { params: {} } as never,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(listShortLinksForAccount).toHaveBeenCalledWith(expect.any(String));
  });
});

describe("POST /api/short-links", () => {
  beforeEach(() => {
    vi.mocked(createShortLinkForAccount).mockResolvedValue({
      id: "link-1",
      slug: "landing01",
      target_url: "https://example.com",
      delivery_mode: "inherit_channel",
      landing_template_key: "ctv_neutral",
    } as never);
  });

  it("creates a short-link with sales-channel delivery fields", async () => {
    const response = await createShortLink(
      createTestRequest("http://localhost/api/short-links", {
        method: "POST",
        body: {
          target_url: "https://example.com",
          title: "Link test",
          sales_channel_id: "550e8400-e29b-41d4-a716-446655440001",
          delivery_mode: "inherit_channel",
          landing_template_key: "ctv_neutral",
          require_token: false,
          notify_clicks: true,
        },
      }),
      { params: {} } as never,
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.slug).toBe("landing01");
    expect(createShortLinkForAccount).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        sales_channel_id: "550e8400-e29b-41d4-a716-446655440001",
        delivery_mode: "inherit_channel",
        landing_template_key: "ctv_neutral",
        notify_clicks: true,
      }),
    );
  });

  it("rejects invalid target URLs", async () => {
    const response = await createShortLink(
      createTestRequest("http://localhost/api/short-links", {
        method: "POST",
        body: {
          target_url: "not-a-url",
        },
      }),
      { params: {} } as never,
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("GET /api/short-links/[id]", () => {
  beforeEach(() => {
    vi.mocked(getShortLinkDetailForAccount).mockResolvedValue({
      link: {
        id: "link-1",
        slug: "landing01",
        target_url: "https://example.com",
      },
      salesChannel: {
        id: "channel-1",
        name: "CTV",
        defaultDeliveryMode: "landing_page",
        defaultLandingTemplateKey: "ctv_neutral",
      },
      resolvedPolicy: {
        effectiveDeliveryMode: "landing_page",
        effectiveLandingTemplateKey: "ctv_neutral",
        deliveryModeSource: "channel_default",
        landingTemplateSource: "channel_default",
      },
    } as never);
    vi.mocked(getClickAnalytics).mockResolvedValue({
      clicks: [],
      stats: { totalClicks: 0, suspiciousCount: 0, uniqueIPs: 0, devices: {} },
    } as never);
  });

  it("returns link detail with sales-channel policy context", async () => {
    const response = await getShortLinkDetail(
      createTestRequest("http://localhost/api/short-links/link-1"),
      { params: Promise.resolve({ id: "link-1" }) } as never,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.salesChannel.name).toBe("CTV");
    expect(body.data.resolvedPolicy.effectiveDeliveryMode).toBe("landing_page");
  });
});

describe("PATCH /api/short-links/[id]", () => {
  beforeEach(() => {
    vi.mocked(updateShortLinkForAccount).mockResolvedValue({
      id: "link-1",
      delivery_mode: "landing_page",
      landing_template_key: "owner_intro",
      locked_ipv6: null,
    } as never);
  });

  it("updates landing and lock fields", async () => {
    const response = await updateShortLink(
      createTestRequest("http://localhost/api/short-links/link-1", {
        method: "PATCH",
        body: {
          delivery_mode: "landing_page",
          landing_template_key: "owner_intro",
          locked_ipv6: null,
        },
      }),
      { params: Promise.resolve({ id: "link-1" }) } as never,
    );

    expect(response.status).toBe(200);
    expect(updateShortLinkForAccount).toHaveBeenCalledWith(
      "link-1",
      expect.any(String),
      expect.objectContaining({
        delivery_mode: "landing_page",
        landing_template_key: "owner_intro",
        locked_ipv6: null,
      }),
    );
  });

  it("rejects empty updates", async () => {
    const response = await updateShortLink(
      createTestRequest("http://localhost/api/short-links/link-1", {
        method: "PATCH",
        body: {},
      }),
      { params: Promise.resolve({ id: "link-1" }) } as never,
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("DELETE /api/short-links/[id]", () => {
  it("deletes a short-link", async () => {
    vi.mocked(deleteShortLink).mockResolvedValue(undefined as never);

    const response = await deleteShortLinkRoute(
      createTestRequest("http://localhost/api/short-links/link-1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "link-1" }) } as never,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.deleted).toBe(true);
    expect(deleteShortLink).toHaveBeenCalledWith("link-1", expect.any(String));
  });
});
