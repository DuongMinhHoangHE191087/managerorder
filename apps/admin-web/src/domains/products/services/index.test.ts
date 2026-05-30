import { describe, expect, it, vi, beforeEach } from "vitest";
import { createProductForAccount, updateProductForAccount } from "./index";

const mockListProducts = vi.fn();
const mockCreateProduct = vi.fn();
const mockUpdateProduct = vi.fn();
const mockDeleteProduct = vi.fn();
const mockGetProductById = vi.fn();
const mockCreateActivityLog = vi.fn().mockResolvedValue(null);
const mockPendingOrderIn = vi.fn();
const mockPendingOrderEq2 = vi.fn().mockReturnValue({ in: mockPendingOrderIn });
const mockPendingOrderEq1 = vi.fn().mockReturnValue({ eq: mockPendingOrderEq2 });
const mockPendingOrderSelect = vi.fn().mockReturnValue({ eq: mockPendingOrderEq1 });

vi.mock("../repository", () => ({
  listProducts: (...args: unknown[]) => mockListProducts(...args),
  createProduct: (...args: unknown[]) => mockCreateProduct(...args),
  updateProduct: (...args: unknown[]) => mockUpdateProduct(...args),
  deleteProduct: (...args: unknown[]) => mockDeleteProduct(...args),
  getProductById: (...args: unknown[]) => mockGetProductById(...args),
}));

vi.mock("@/lib/supabase/repositories/activity-logs.repo", () => ({
  createActivityLog: (...args: unknown[]) => mockCreateActivityLog(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: () => ({
      select: mockPendingOrderSelect,
    }),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockPendingOrderIn.mockResolvedValue({ count: 0 });
});

describe("product service", () => {
  it("creates a product and logs the activity", async () => {
    mockCreateProduct.mockResolvedValue({
      id: "p-new",
      name: "Netflix Premium",
      mode: "slot",
      buy_price_vnd: 50000,
      sell_price_vnd: 150000,
      duration_type: "months",
      duration_value: 1,
      is_active: true,
    });

    const result = await createProductForAccount("00000000-0000-4000-8000-000000000016", {
      name: "Netflix Premium",
      mode: "slot",
      buyPriceVnd: 50000,
      sellPriceVnd: 150000,
      durationType: "months",
      durationValue: 1,
      isActive: true,
    });

    expect(result).toEqual({
      id: "p-new",
      name: "Netflix Premium",
      mode: "slot",
      buyPriceVnd: 50000,
      sellPriceVnd: 150000,
      durationType: "months",
      durationValue: 1,
      isActive: true,
      iconUrl: null,
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockCreateActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        account_id: "00000000-0000-4000-8000-000000000016",
        action_type: "PRODUCT_CREATED",
      }),
    );
  });

  it("blocks price changes when pending orders still exist", async () => {
    mockGetProductById.mockResolvedValue({
      id: "00000000-0000-4000-8000-0000000003ed",
      sell_price_vnd: 100000,
    });
    mockPendingOrderIn.mockResolvedValue({ count: 2 });

    await expect(
      updateProductForAccount("00000000-0000-4000-8000-0000000003ed", "00000000-0000-4000-8000-000000000016", {
        sellPriceVnd: 200000,
      }),
    ).rejects.toThrow("Không thể thay đổi giá khi còn đơn hàng chưa thanh toán");

    expect(mockUpdateProduct).not.toHaveBeenCalled();
  });
});
