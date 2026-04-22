import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TEST_ACCOUNT_ID, createTestRequest } from "./helpers/setup";

type RouteModule = typeof import("@/app/api/cron/premium-renewal-reminder/route");

const eligibleSubscription = {
  id: "subscription-1",
  account_id: TEST_ACCOUNT_ID,
  customer_id: "customer-1",
  premium_account_id: "premium-account-1",
  service_type_id: "service-type-1",
  package_id: "package-1",
  expiry_date: "2026-04-29T00:00:00+07:00",
  start_date: "2026-03-29T00:00:00+07:00",
  original_price: 120000,
  final_price: 150000,
  renewal_status: "none",
  status: "active",
};

function createSubscriptionsQuery(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data, error }),
  };
}

function createReminderLogsTable(selectPayloads: unknown[]) {
  let selectIndex = 0;
  const insert = vi.fn().mockResolvedValue({ data: null, error: null });

  return {
    insert,
    factory: () => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation(async () => ({
        data: selectPayloads[selectIndex++] ?? [],
        error: null,
      })),
      insert,
    }),
  };
}

function createRelationLookup(table: string) {
  if (table === "customers") {
    return new Map([["customer-1", { id: "customer-1", full_name: "Nguyen Van A" }]]);
  }
  if (table === "premium_accounts") {
    return new Map([["premium-account-1", { id: "premium-account-1", primary_email: "netflix@slot.local" }]]);
  }
  if (table === "premium_packages") {
    return new Map([["package-1", { id: "package-1", name: "Goi 4 slot" }]]);
  }
  if (table === "premium_service_types") {
    return new Map([["service-type-1", { id: "service-type-1", name: "Netflix" }]]);
  }
  return new Map();
}

async function loadRoute(options?: {
  from?: ReturnType<typeof vi.fn>;
  reminderLogResponses?: unknown[];
  getReminderConfigResult?: {
    t7_enabled: boolean;
    t3_enabled: boolean;
    t1_enabled: boolean;
    channel: "telegram" | "zalo" | "both";
    template_renewal: string;
    template_renewal_internal: string;
    template_renewal_zalo: string;
    template_expired_zalo: string;
    auto_send: boolean;
  };
  getDaysRemainingValue?: number;
  zaloTargets?: Array<{ chatId: string }>;
}) {
  vi.resetModules();

  const reminderConfig = options?.getReminderConfigResult ?? {
    t7_enabled: true,
    t3_enabled: true,
    t1_enabled: true,
    channel: "both" as const,
    template_renewal: "customer:{customer_name}",
    template_renewal_internal: "internal:{customer_name}",
    template_renewal_zalo: "zalo:{customer_name}",
    template_expired_zalo: "expired:{customer_name}",
    auto_send: true,
  };

  const getReminderConfig = vi.fn().mockResolvedValue(reminderConfig);
  const buildReminderTemplateContext = vi.fn((input: { customerName?: string | null; status?: string | null }) => ({
    customer_name: input.customerName ?? "Khach hang",
    product_name: "Netflix - Goi 4 slot",
    expiry_date: "29/04/2026",
    due_date: "29/04/2026",
    debt_amount: "150.000d",
    balance_due: "150.000d",
    days_left: String(options?.getDaysRemainingValue ?? 7),
    order_code: "SUBSCRIP",
    order_status: input.status ?? "active",
  }));
  const renderReminderTemplate = vi.fn(
    (template: string, context: { customer_name: string }) => `${template}:${context.customer_name}`,
  );
  const listCustomerZaloReminderTargets = vi
    .fn()
    .mockResolvedValue(options?.zaloTargets ?? [{ chatId: "zalo-chat-1" }]);
  const sendTelegramMessage = vi.fn().mockResolvedValue(true);
  const sendZaloTextMessage = vi.fn().mockResolvedValue(true);
  const loadRowsByIds = vi
    .fn()
    .mockImplementation(async (_supabase, table: string) => createRelationLookup(table));
  const getDaysRemaining = vi.fn().mockReturnValue(options?.getDaysRemainingValue ?? 7);

  const reminderLogsTable = createReminderLogsTable(options?.reminderLogResponses ?? [[], []]);
  const subscriptionsQuery = createSubscriptionsQuery([eligibleSubscription]);
  const from = options?.from ?? vi.fn((table: string) => {
    if (table === "customer_premium_subscriptions") {
      return subscriptionsQuery;
    }
    if (table === "reminder_logs") {
      return reminderLogsTable.factory();
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  vi.doMock("@/lib/bot-manager/reminder-config", () => ({
    getReminderConfig,
    buildReminderTemplateContext,
    renderReminderTemplate,
  }));
  vi.doMock("@/lib/bot-manager/bot-contacts", () => ({
    listCustomerZaloReminderTargets,
  }));
  vi.doMock("@/lib/utils/telegram", () => ({
    sendTelegramMessage,
  }));
  vi.doMock("@/lib/zalo/outbound", () => ({
    sendZaloTextMessage,
  }));
  vi.doMock("@/lib/supabase/relation-fallback", () => ({
    loadRowsByIds,
  }));
  vi.doMock("@/lib/utils/premium-accounts-helpers", () => ({
    getDaysRemaining,
  }));
  vi.doMock("@/lib/supabase/admin", () => ({
    supabaseAdmin: {
      from,
    },
  }));

  const route = (await import("@/app/api/cron/premium-renewal-reminder/route")) as RouteModule;

  return {
    route,
    mocks: {
      getReminderConfig,
      listCustomerZaloReminderTargets,
      sendTelegramMessage,
      sendZaloTextMessage,
      reminderLogInsert: reminderLogsTable.insert,
    },
  };
}

describe("GET /api/cron/premium-renewal-reminder", () => {
  const previousCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (previousCronSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = previousCronSecret;
    }
  });

  it("returns 500 when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    const { route } = await loadRoute();

    const response = await route.GET(
      createTestRequest("http://localhost/api/cron/premium-renewal-reminder"),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "CRON_SECRET not configured",
    });
  });

  it("returns 401 when the bearer secret is invalid", async () => {
    process.env.CRON_SECRET = "cron-secret";
    const { route } = await loadRoute();

    const response = await route.GET(
      createTestRequest("http://localhost/api/cron/premium-renewal-reminder", {
        headers: {
          authorization: "Bearer wrong-secret",
        },
      }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "Unauthorized",
    });
  });

  it("sends telegram and zalo reminders for an eligible subscription and logs both deliveries", async () => {
    process.env.CRON_SECRET = "cron-secret";
    const { route, mocks } = await loadRoute();

    const response = await route.GET(
      createTestRequest("http://localhost/api/cron/premium-renewal-reminder", {
        headers: {
          authorization: "Bearer cron-secret",
        },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      sentCount: 2,
      skippedCount: 0,
      totalSubscriptions: 1,
      errors: undefined,
    });
    expect(mocks.getReminderConfig).toHaveBeenCalledWith(TEST_ACCOUNT_ID);
    expect(mocks.sendTelegramMessage).toHaveBeenCalledTimes(1);
    expect(mocks.listCustomerZaloReminderTargets).toHaveBeenCalledWith(TEST_ACCOUNT_ID, "customer-1");
    expect(mocks.sendZaloTextMessage).toHaveBeenCalledWith(
      "zalo-chat-1",
      expect.stringContaining("Nguyen Van A"),
    );
    expect(mocks.reminderLogInsert).toHaveBeenCalledTimes(2);
  });

  it("stays idempotent by skipping channels that were already sent today", async () => {
    process.env.CRON_SECRET = "cron-secret";
    const { route, mocks } = await loadRoute({
      reminderLogResponses: [[{ id: "log-telegram" }], [{ id: "log-zalo" }]],
    });

    const response = await route.GET(
      createTestRequest("http://localhost/api/cron/premium-renewal-reminder", {
        headers: {
          authorization: "Bearer cron-secret",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      sentCount: 0,
      skippedCount: 2,
      totalSubscriptions: 1,
      errors: undefined,
    });
    expect(mocks.sendTelegramMessage).not.toHaveBeenCalled();
    expect(mocks.sendZaloTextMessage).not.toHaveBeenCalled();
    expect(mocks.reminderLogInsert).not.toHaveBeenCalled();
  });
});
