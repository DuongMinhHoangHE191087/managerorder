import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTestRequest,
  mockRBAC,
  mockWithAccount,
  mockWithErrorHandler,
} from "./helpers/setup";

vi.mock("@/lib/api/with-account", () => mockWithAccount());
vi.mock("@/lib/api/with-error-handler", () => mockWithErrorHandler());
vi.mock("@/lib/api/rbac", () => mockRBAC());
vi.mock("@/domains/sales-channels", () => ({
  createSalesChannelForAccount: vi.fn(),
  deleteSalesChannelForAccount: vi.fn(),
  listSalesChannelsForAccount: vi.fn(),
  updateSalesChannelForAccount: vi.fn(),
}));
vi.mock("@/lib/supabase/repositories/activity-logs.repo", () => ({
  createActivityLog: vi.fn().mockResolvedValue(undefined),
}));

import {
  createSalesChannelForAccount,
  deleteSalesChannelForAccount,
  listSalesChannelsForAccount,
  updateSalesChannelForAccount,
} from "@/domains/sales-channels";
import { GET as listSalesChannels, POST as createSalesChannel } from "@/app/api/settings/sales-channels/route";
import {
  DELETE as deleteSalesChannel,
  PUT as updateSalesChannel,
} from "@/app/api/settings/sales-channels/[id]/route";

describe("GET /api/settings/sales-channels", () => {
  it("returns the configured sales channels", async () => {
    vi.mocked(listSalesChannelsForAccount).mockResolvedValue([
      {
        id: "channel-1",
        name: "CTV",
        defaultDeliveryMode: "landing_page",
        defaultLandingTemplateKey: "ctv_neutral",
        runtime: {
          linkedOrderCount: 2,
          shortLinkCount: 3,
          landingLinkCount: 2,
          directLinkCount: 1,
          inheritedLinkCount: 1,
          overrideLinkCount: 2,
        },
      },
    ] as never);

    const response = await listSalesChannels(
      createTestRequest("http://localhost/api/settings/sales-channels"),
      { params: {} } as never,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data[0].defaultDeliveryMode).toBe("landing_page");
    expect(body.data[0].runtime.shortLinkCount).toBe(3);
  });
});

describe("POST /api/settings/sales-channels", () => {
  beforeEach(() => {
    vi.mocked(createSalesChannelForAccount).mockResolvedValue({
      id: "channel-1",
      name: "CTV",
      defaultDeliveryMode: "landing_page",
      defaultLandingTemplateKey: "ctv_neutral",
    } as never);
  });

  it("creates a sales channel with short-link policy defaults", async () => {
    const response = await createSalesChannel(
      createTestRequest("http://localhost/api/settings/sales-channels", {
        method: "POST",
        body: {
          name: "CTV",
          defaultDeliveryMode: "landing_page",
          defaultLandingTemplateKey: "ctv_neutral",
        },
      }),
      { params: {} } as never,
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.defaultLandingTemplateKey).toBe("ctv_neutral");
    expect(createSalesChannelForAccount).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        name: "CTV",
        defaultDeliveryMode: "landing_page",
        defaultLandingTemplateKey: "ctv_neutral",
      }),
    );
  });

  it("rejects invalid payload", async () => {
    const response = await createSalesChannel(
      createTestRequest("http://localhost/api/settings/sales-channels", {
        method: "POST",
        body: {},
      }),
      { params: {} } as never,
    );

    expect(response.status).toBe(400);
  });
});

describe("PUT /api/settings/sales-channels/[id]", () => {
  beforeEach(() => {
    vi.mocked(updateSalesChannelForAccount).mockResolvedValue({
      id: "channel-1",
      name: "CTV updated",
      defaultDeliveryMode: "direct_redirect",
      defaultLandingTemplateKey: "owner_intro",
    } as never);
  });

  it("updates a sales channel policy", async () => {
    const response = await updateSalesChannel(
      createTestRequest("http://localhost/api/settings/sales-channels/channel-1", {
        method: "PUT",
        body: {
          defaultDeliveryMode: "direct_redirect",
          defaultLandingTemplateKey: "owner_intro",
        },
      }),
      { params: Promise.resolve({ id: "channel-1" }) } as never,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.defaultDeliveryMode).toBe("direct_redirect");
    expect(updateSalesChannelForAccount).toHaveBeenCalledWith(
      "channel-1",
      expect.any(String),
      expect.objectContaining({
        defaultDeliveryMode: "direct_redirect",
        defaultLandingTemplateKey: "owner_intro",
      }),
    );
  });
});

describe("DELETE /api/settings/sales-channels/[id]", () => {
  it("deletes a sales channel", async () => {
    vi.mocked(deleteSalesChannelForAccount).mockResolvedValue(undefined as never);

    const response = await deleteSalesChannel(
      createTestRequest("http://localhost/api/settings/sales-channels/channel-1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "channel-1" }) } as never,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(deleteSalesChannelForAccount).toHaveBeenCalledWith(
      "channel-1",
      expect.any(String),
    );
  });
});
