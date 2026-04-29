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
      id: "00000000-0000-4000-8000-000000000040",
      email: "storage@example.com",
      notes: {
        password: "plain-password",
        credentials: [
          { type: "2fa", value: "123456", label: "OTP" },
          { id: "00000000-0000-4000-8000-0000000000cd", type: "backup", value: "backup-value" },
        ],
      },
    });

    const result = await getDecryptedSourceAccountSecretsForAccount("00000000-0000-4000-8000-000000000040", "00000000-0000-4000-8000-000000000016");

    expect(mockGetSourceAccountById).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000040", "00000000-0000-4000-8000-000000000016");
    expect(result).toEqual({
      id: "00000000-0000-4000-8000-000000000040",
      email: "storage@example.com",
      password: "plain-password",
      credentials: [
        {
          id: "00000000-0000-4000-8000-000000000040-cred-1",
          type: "2fa",
          value: "123456",
          label: "OTP",
        },
        {
          id: "00000000-0000-4000-8000-0000000000cd",
          type: "backup",
          value: "backup-value",
        },
      ],
    });
  });

  it("delegates smart match scans to the shared matcher", async () => {
    mockScanSmartMatches.mockResolvedValue([
      {
        sourceAccountId: "00000000-0000-4000-8000-000000000040",
        sourceAccountEmail: "storage@example.com",
        orderItemId: "00000000-0000-4000-8000-000000000058",
        orderItemQuantity: 1,
        productNameSnapshot: "Netflix",
        customerName: "Customer A",
        orderId: "00000000-0000-4000-8000-00000000005b",
        matchedField: "reserved_nick",
        matchedValue: "nick-a",
        confidence: 100,
      },
    ]);

    const result = await scanSmartMatchesForAccount("00000000-0000-4000-8000-000000000016");

    expect(mockScanSmartMatches).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000016");
    expect(result[0]?.matchedField).toBe("reserved_nick");
  });

  it("delegates search queries to the shared matcher", async () => {
    mockSearchUnconnectedByNickOrNote.mockResolvedValue([
      {
        id: "00000000-0000-4000-8000-000000000058",
        product_id: "00000000-0000-4000-8000-000000000039",
        product_name_snapshot: "Netflix",
        quantity: 1,
        notes: "reserved nick",
        customer_nick_used: "nick-a",
        assigned_source_account_id: null,
        order_id: "00000000-0000-4000-8000-00000000005b",
      },
    ]);

    const result = await searchUnconnectedSourceAccountsForAccount("00000000-0000-4000-8000-000000000040", "00000000-0000-4000-8000-000000000016", "nick");

    expect(mockSearchUnconnectedByNickOrNote).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000040", "00000000-0000-4000-8000-000000000016", "nick");
    expect(result).toHaveLength(1);
  });
});
