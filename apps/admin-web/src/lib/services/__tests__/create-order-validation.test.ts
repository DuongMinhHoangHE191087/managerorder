import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock("@/lib/supabase/repositories/activity-logs.repo", () => ({
  createActivityLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/cache/db-cache", () => ({
  invalidate: vi.fn(),
}));

vi.mock("@/lib/utils/order-code", () => ({
  generateOrderCode: vi.fn().mockReturnValue("DMH_TEST_240426"),
}));

vi.mock("@/lib/services/event-bus.service", () => ({
  emitEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/supabase/tenant-client", () => ({
  createTenantQuery: vi.fn(),
}));

vi.mock("@/lib/settings/system-settings", () => ({
  normalizeSystemSettings: vi.fn((input) => input ?? {}),
}));

import { createTenantQuery } from "@/lib/supabase/tenant-client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createOrderWithItems } from "@/lib/services/order.service";

function createResolvedBuilder(result: unknown) {
  const builder: Record<string, any> = {
    select: vi.fn(),
    in: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
    update: vi.fn(),
    limit: vi.fn(),
  };

  builder.select.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.update.mockReturnValue(builder);
  builder.limit.mockResolvedValue(result);
  builder.single.mockResolvedValue(result);
  builder.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);

  return builder;
}

describe("createOrderWithItems validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects empty order items before touching persistence", async () => {
    await expect(
      createOrderWithItems("00000000-0000-4000-8000-000000000016", {
        customerId: "00000000-0000-4000-8000-000000000005",
        items: [],
      }),
    ).rejects.toMatchObject({
      message: "Đơn hàng phải có ít nhất 1 sản phẩm",
      status: 400,
    });

    expect(supabaseAdmin.from).not.toHaveBeenCalled();
    expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
  });

  it("rejects invalid line-item quantity before touching persistence", async () => {
    await expect(
      createOrderWithItems("00000000-0000-4000-8000-000000000016", {
        customerId: "00000000-0000-4000-8000-000000000005",
        items: [{ productId: "00000000-0000-4000-8000-000000000039", quantity: 0 }],
      }),
    ).rejects.toMatchObject({
      message: "Số lượng không hợp lệ cho sản phẩm 00000000-0000-4000-8000-000000000039",
      status: 400,
    });

    expect(supabaseAdmin.from).not.toHaveBeenCalled();
    expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
  });

  it("rejects invalid registeredAt values before touching persistence", async () => {
    await expect(
      createOrderWithItems("00000000-0000-4000-8000-000000000016", {
        customerId: "00000000-0000-4000-8000-000000000005",
        registeredAt: "not-a-date",
        items: [{ productId: "00000000-0000-4000-8000-000000000039", quantity: 1 }],
      }),
    ).rejects.toMatchObject({
      message: "Ngày đăng ký không hợp lệ",
      status: 400,
    });

    expect(supabaseAdmin.from).not.toHaveBeenCalled();
    expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
  });

  it("rejects corrupt product pricing from the catalog before RPC creation", async () => {
    vi.mocked(createTenantQuery).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    } as never);

    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === "products") {
        return createResolvedBuilder({
          data: [
            {
              id: "00000000-0000-4000-8000-000000000039",
              name: "Netflix Premium",
              buy_price_vnd: 100_000,
              sell_price_vnd: Number.NaN,
              duration_type: "months",
              duration_value: 1,
              is_active: true,
            },
          ],
          error: null,
        }) as never;
      }

      if (table === "customers") {
        return createResolvedBuilder({
          data: {
            full_name: "Khách A",
            nicks_registry: [],
          },
          error: null,
        }) as never;
      }

      return createResolvedBuilder({ data: null, error: null }) as never;
    });

    await expect(
      createOrderWithItems("00000000-0000-4000-8000-000000000016", {
        customerId: "00000000-0000-4000-8000-000000000005",
        items: [{ productId: "00000000-0000-4000-8000-000000000039", quantity: 1 }],
      }),
    ).rejects.toMatchObject({
      message: "Giá bán cấu hình không hợp lệ cho sản phẩm Netflix Premium",
      status: 422,
    });

    expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
  });
});
