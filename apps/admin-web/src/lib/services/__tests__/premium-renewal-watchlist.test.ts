import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  supabaseFrom: vi.fn(),
  loadRowsByIds: vi.fn(),
  subscriptionsRows: [] as Record<string, unknown>[],
  contactRows: [] as Record<string, unknown>[],
}));

function createSubscriptionsBuilder(rows: Record<string, unknown>[]) {
  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    is: vi.fn(() => chain),
    order: vi.fn(() => Promise.resolve({ data: rows, error: null })),
  };
  return chain;
}

function createContactsBuilder(rows: Record<string, unknown>[]) {
  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    in: vi.fn(() => Promise.resolve({ data: rows, error: null })),
  };
  return chain;
}

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: mocks.supabaseFrom,
  },
}));

vi.mock("@/lib/supabase/relation-fallback", () => ({
  loadRowsByIds: mocks.loadRowsByIds,
}));

import { getPremiumRenewalWatchlist } from "../premium-renewal-watchlist";

describe("getPremiumRenewalWatchlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-24T10:00:00.000Z"));
    mocks.subscriptionsRows = [];
    mocks.contactRows = [];

    mocks.supabaseFrom.mockImplementation((table: string) => {
      if (table === "customer_premium_subscriptions") {
        return createSubscriptionsBuilder(mocks.subscriptionsRows);
      }
      if (table === "customer_contacts") {
        return createContactsBuilder(mocks.contactRows);
      }
      throw new Error(`Unexpected table lookup: ${table}`);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("groups expired and expiring subscriptions with contact + notification message", async () => {
    mocks.subscriptionsRows = [
      {
        id: "00000000-0000-4000-8000-0000000000d1",
        customer_id: "00000000-0000-4000-8000-000000000005",
        premium_account_id: "00000000-0000-4000-8000-0000000003f0",
        premium_account_user_id: "00000000-0000-4000-8000-000000000100",
        service_type_id: "00000000-0000-4000-8000-000000000101",
        expiry_date: "2026-04-20",
        status: "expired",
      },
      {
        id: "00000000-0000-4000-8000-0000000000d2",
        customer_id: "00000000-0000-4000-8000-000000000006",
        premium_account_id: "00000000-0000-4000-8000-0000000003f1",
        premium_account_user_id: null,
        service_type_id: "00000000-0000-4000-8000-000000000101",
        expiry_date: "2026-04-27",
        status: "active",
      },
      {
        id: "00000000-0000-4000-8000-0000000000d3",
        customer_id: "00000000-0000-4000-8000-000000000102",
        premium_account_id: "00000000-0000-4000-8000-0000000003f2",
        premium_account_user_id: null,
        service_type_id: "00000000-0000-4000-8000-000000000101",
        expiry_date: "2026-05-12",
        status: "active",
      },
    ];

    mocks.contactRows = [
      {
        customer_id: "00000000-0000-4000-8000-000000000005",
        channel: "zalo",
        value: "zalo-expired",
        is_verified: true,
      },
      {
        customer_id: "00000000-0000-4000-8000-000000000006",
        channel: "email",
        value: "customer2@example.com",
        is_verified: false,
      },
    ];

    mocks.loadRowsByIds.mockImplementation(async (_client, table: string) => {
      if (table === "customers") {
        return new Map([
          ["00000000-0000-4000-8000-000000000005", { id: "00000000-0000-4000-8000-000000000005", full_name: "Khách Hết Hạn", phone: null, email: null }],
          ["00000000-0000-4000-8000-000000000006", { id: "00000000-0000-4000-8000-000000000006", full_name: "Khách Sắp Hạn", phone: null, email: "fallback@sample.test" }],
          ["00000000-0000-4000-8000-000000000102", { id: "00000000-0000-4000-8000-000000000102", full_name: "Khách Xa Hạn", phone: null, email: null }],
        ]);
      }
      if (table === "premium_accounts") {
        return new Map([
          ["00000000-0000-4000-8000-0000000003f0", { id: "00000000-0000-4000-8000-0000000003f0", primary_email: "expired@nick.test" }],
          ["00000000-0000-4000-8000-0000000003f1", { id: "00000000-0000-4000-8000-0000000003f1", primary_email: "soon@nick.test" }],
          ["00000000-0000-4000-8000-0000000003f2", { id: "00000000-0000-4000-8000-0000000003f2", primary_email: "later@nick.test" }],
        ]);
      }
      if (table === "premium_account_users") {
        return new Map([["00000000-0000-4000-8000-000000000100", { id: "00000000-0000-4000-8000-000000000100", user_email: "child@nick.test" }]]);
      }
      if (table === "premium_service_types") {
        return new Map([["00000000-0000-4000-8000-000000000101", { id: "00000000-0000-4000-8000-000000000101", name: "Netflix Premium" }]]);
      }
      throw new Error(`Unexpected relation table: ${table}`);
    });

    const result = await getPremiumRenewalWatchlist({
      accountId: "00000000-0000-4000-8000-000000000016",
      daysThreshold: 7,
      limit: 20,
    });

    expect(result.summary).toEqual({
      expiredCount: 1,
      expiringSoonCount: 1,
      totalActionable: 2,
    });

    expect(result.expired).toHaveLength(1);
    expect(result.expired[0]).toMatchObject({
      subscriptionId: "00000000-0000-4000-8000-0000000000d1",
      customerName: "Khách Hết Hạn",
      nick: "child@nick.test",
      serviceName: "Netflix Premium",
      contactChannel: "Zalo",
      contactValue: "zalo-expired",
      daysUntilExpiry: -4,
      urgency: "expired",
    });
    expect(result.expired[0].notificationMessage).toContain("đã hết hạn");

    expect(result.expiringSoon).toHaveLength(1);
    expect(result.expiringSoon[0]).toMatchObject({
      subscriptionId: "00000000-0000-4000-8000-0000000000d2",
      customerName: "Khách Sắp Hạn",
      nick: "soon@nick.test",
      contactChannel: "Email",
      contactValue: "customer2@example.com",
      daysUntilExpiry: 3,
      urgency: "expiring",
    });
    expect(result.expiringSoon[0].notificationMessage).toContain("sẽ hết hạn");
  });

  it("falls back to phone/email when customer_contacts are missing", async () => {
    mocks.subscriptionsRows = [
      {
        id: "00000000-0000-4000-8000-0000000000d4",
        customer_id: "00000000-0000-4000-8000-0000000000e1",
        premium_account_id: "00000000-0000-4000-8000-0000000000e2",
        premium_account_user_id: null,
        service_type_id: "00000000-0000-4000-8000-000000000101",
        expiry_date: "2026-04-25",
        status: "active",
      },
    ];
    mocks.contactRows = [];

    mocks.loadRowsByIds.mockImplementation(async (_client, table: string) => {
      if (table === "customers") {
        return new Map([
          ["00000000-0000-4000-8000-0000000000e1", { id: "00000000-0000-4000-8000-0000000000e1", full_name: "Khách Không Contact", phone: "0909000111", email: "fallback@mail.test" }],
        ]);
      }
      if (table === "premium_accounts") {
        return new Map([["00000000-0000-4000-8000-0000000000e2", { id: "00000000-0000-4000-8000-0000000000e2", primary_email: "nick-fallback@test.local" }]]);
      }
      if (table === "premium_account_users") {
        return new Map();
      }
      if (table === "premium_service_types") {
        return new Map([["00000000-0000-4000-8000-000000000101", { id: "00000000-0000-4000-8000-000000000101", name: "Canva Pro" }]]);
      }
      throw new Error(`Unexpected relation table: ${table}`);
    });

    const result = await getPremiumRenewalWatchlist({
      accountId: "00000000-0000-4000-8000-000000000084",
      daysThreshold: 7,
      limit: 20,
    });

    expect(result.summary.expiredCount).toBe(0);
    expect(result.summary.expiringSoonCount).toBe(1);
    expect(result.expiringSoon[0]).toMatchObject({
      contactChannel: "SĐT",
      contactValue: "0909000111",
      customerName: "Khách Không Contact",
    });
  });
});
