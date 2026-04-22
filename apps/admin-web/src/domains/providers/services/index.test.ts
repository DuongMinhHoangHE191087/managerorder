import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createProviderForAccount,
  deleteProviderForAccount,
  updateProviderForAccount,
} from "./index";

const mockListProviders = vi.fn();
const mockCreateProvider = vi.fn();
const mockGetProviderById = vi.fn();
const mockUpdateProvider = vi.fn();
const mockDeleteProvider = vi.fn();
const mockCreateActivityLog = vi.fn().mockResolvedValue(null);

vi.mock("../repository", () => ({
  listProviders: (...args: unknown[]) => mockListProviders(...args),
  createProvider: (...args: unknown[]) => mockCreateProvider(...args),
  getProviderById: (...args: unknown[]) => mockGetProviderById(...args),
  updateProvider: (...args: unknown[]) => mockUpdateProvider(...args),
  deleteProvider: (...args: unknown[]) => mockDeleteProvider(...args),
}));

vi.mock("@/lib/supabase/repositories/activity-logs.repo", () => ({
  createActivityLog: (...args: unknown[]) => mockCreateActivityLog(...args),
}));

describe("provider service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes contacts and logs on create", async () => {
    mockCreateProvider.mockResolvedValue({
      id: "pv-1",
      name: "Provider A",
      contacts: [
        {
          id: "contact-1",
          type: "facebook",
          value: "provider-a",
          isPrimary: true,
          facebookId: "fb-1",
          facebookName: "Provider A",
        },
      ],
      tier: "regular",
      reliability_score: 88,
      created_at: "2026-04-15T12:00:00.000Z",
      total_import_amount_vnd: 0,
      purchase_order_count: 0,
    });

    const result = await createProviderForAccount(
      "acc-1",
      {
        name: "Provider A",
        tier: "regular",
        reliabilityScore: 88,
        contacts: [
          {
            id: "",
            type: "facebook",
            value: "provider-a",
            isPrimary: true,
            facebookId: "fb-1",
            facebookName: "Provider A",
          },
        ],
      },
      "owner@example.com",
    );

    expect(mockCreateProvider).toHaveBeenCalledWith(
      "acc-1",
      expect.objectContaining({
        name: "Provider A",
        reliability_score: 88,
        contacts: [
          expect.objectContaining({
            type: "facebook",
            value: "provider-a",
            isPrimary: true,
            facebookId: "fb-1",
          }),
        ],
      }),
    );
    expect(result.name).toBe("Provider A");

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockCreateActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        account_id: "acc-1",
        created_by: "owner@example.com",
      }),
    );
  });

  it("validates reliability score on update", async () => {
    await expect(
      updateProviderForAccount("pv-1", "acc-1", {
        reliabilityScore: 120,
      }),
    ).rejects.toThrow("Điểm uy tín phải nằm trong khoảng 0-100");

    expect(mockUpdateProvider).not.toHaveBeenCalled();
  });

  it("loads the provider before delete so the activity log keeps the name", async () => {
    mockGetProviderById.mockResolvedValue({
      id: "pv-1",
      name: "Provider A",
    });
    mockDeleteProvider.mockResolvedValue(undefined);

    await deleteProviderForAccount("pv-1", "acc-1", "owner@example.com");

    expect(mockGetProviderById).toHaveBeenCalledWith("pv-1", "acc-1");
    expect(mockDeleteProvider).toHaveBeenCalledWith("pv-1", "acc-1");
  });
});
