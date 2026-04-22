import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getDecryptedSourceAccountSecretsForAccount,
  scanSmartMatchesForAccount,
  searchUnconnectedSourceAccountsForAccount,
} from "./index";

const mockGetSourceAccountById = vi.fn();
const mockScanSmartMatches = vi.fn();
const mockSearchUnconnectedByNickOrNote = vi.fn();

vi.mock("@/lib/supabase/repositories/source-accounts.repo", () => ({
  addReservedNick: vi.fn(),
  createSourceAccount: vi.fn(),
  deleteSourceAccount: vi.fn(),
  disconnectSourceAccount: vi.fn(),
  getConnectionsEnriched: vi.fn(),
  getSlotBreakdown: vi.fn(),
  getSourceAccountById: (...args: unknown[]) => mockGetSourceAccountById(...args),
  getSourceAccountConnections: vi.fn(),
  listSourceAccounts: vi.fn(),
  recalculateAllSlots: vi.fn(),
  recalculateUsedSlots: vi.fn(),
  reconnectSourceAccount: vi.fn(),
  removeReservedNick: vi.fn(),
  updateSourceAccount: vi.fn(),
}));

vi.mock("@/lib/services/smart-matching.service", () => ({
  scanSmartMatches: (...args: unknown[]) => mockScanSmartMatches(...args),
  searchUnconnectedByNickOrNote: (...args: unknown[]) => mockSearchUnconnectedByNickOrNote(...args),
}));

describe("source accounts service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes decrypted credentials and preserves labels", async () => {
    mockGetSourceAccountById.mockResolvedValue({
      id: "sa-1",
      email: "storage@example.com",
      notes: {
        password: "plain-password",
        credentials: [
          { type: "2fa", value: "123456", label: "OTP" },
          { id: "cred-2", type: "backup", value: "backup-value" },
        ],
      },
    });

    const result = await getDecryptedSourceAccountSecretsForAccount("sa-1", "acc-1");

    expect(mockGetSourceAccountById).toHaveBeenCalledWith("sa-1", "acc-1");
    expect(result).toEqual({
      id: "sa-1",
      email: "storage@example.com",
      password: "plain-password",
      credentials: [
        {
          id: "sa-1-cred-1",
          type: "2fa",
          value: "123456",
          label: "OTP",
        },
        {
          id: "cred-2",
          type: "backup",
          value: "backup-value",
        },
      ],
    });
  });

  it("delegates smart match scans to the shared matcher", async () => {
    mockScanSmartMatches.mockResolvedValue([
      {
        sourceAccountId: "sa-1",
        sourceAccountEmail: "storage@example.com",
        orderItemId: "item-1",
        orderItemQuantity: 1,
        productNameSnapshot: "Netflix",
        customerName: "Customer A",
        orderId: "order-1",
        matchedField: "reserved_nick",
        matchedValue: "nick-a",
        confidence: 100,
      },
    ]);

    const result = await scanSmartMatchesForAccount("acc-1");

    expect(mockScanSmartMatches).toHaveBeenCalledWith("acc-1");
    expect(result[0]?.matchedField).toBe("reserved_nick");
  });

  it("delegates search queries to the shared matcher", async () => {
    mockSearchUnconnectedByNickOrNote.mockResolvedValue([
      {
        id: "item-1",
        product_id: "prod-1",
        product_name_snapshot: "Netflix",
        quantity: 1,
        notes: "reserved nick",
        customer_nick_used: "nick-a",
        assigned_source_account_id: null,
        order_id: "order-1",
      },
    ]);

    const result = await searchUnconnectedSourceAccountsForAccount("sa-1", "acc-1", "nick");

    expect(mockSearchUnconnectedByNickOrNote).toHaveBeenCalledWith("sa-1", "acc-1", "nick");
    expect(result).toHaveLength(1);
  });
});
