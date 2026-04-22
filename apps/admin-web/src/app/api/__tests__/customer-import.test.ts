import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockWithAccount,
  mockWithErrorHandler,
  TEST_ACCOUNT_ID,
} from "./helpers/setup";
import { NextRequest } from "next/server";

// Mock middleware
vi.mock("@/lib/api/with-account", () => mockWithAccount());
vi.mock("@/lib/api/with-error-handler", () => mockWithErrorHandler());

// Mock supabaseAdmin
const _mockInsert = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

// Mock parseCustomerXlsx
const mockParseXlsx = vi.fn();
vi.mock("@/lib/services/excel-service", () => ({
  parseCustomerXlsx: (...args: unknown[]) => mockParseXlsx(...args),
}));

import { POST } from "@/app/api/customers/import/route";

// ── Helpers ──────────────────────────────────────────────────

function createImportRequest(
  fileContent?: string | null,
  fileSize?: number,
  fileName = "customers.xlsx"
) {
  const formData = new FormData();
  if (fileContent !== null) {
    const blob = new Blob([fileContent ?? "fake-xlsx-data"], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    // Override size if specified for testing large files
    if (fileSize) {
      Object.defineProperty(blob, "size", { value: fileSize });
    }
    formData.append("file", blob, fileName);
  }

  return new NextRequest("http://localhost:3000/api/customers/import", {
    method: "POST",
    body: formData,
    headers: {
      "x-account-id": TEST_ACCOUNT_ID,
    },
  });
}

beforeEach(() => vi.clearAllMocks());

// ── Tests ────────────────────────────────────────────────────

describe("POST /api/customers/import", () => {
  it("imports customers successfully", async () => {
    const validRows = [
      { fullName: "Khách A", customerType: "retail", notes: "Note A" },
      { fullName: "Khách B", customerType: "wholesale" },
    ];
    mockParseXlsx.mockReturnValue({
      validRows,
      errors: [],
      totalRows: 2,
    });

    // Mock insert chain
    mockFrom.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    });

    const request = createImportRequest("fake-xlsx");
    const response = await POST(request, { params: {} } as any);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.createdCount).toBe(2);
    expect(json.totalRows).toBe(2);
    expect(json.skippedCount).toBe(0);
    expect(json.insertErrors).toEqual([]);
    expect(json.parseErrors).toEqual([]);
  });

  it("returns 400 when no file is provided", async () => {
    const request = createImportRequest(null);
    const response = await POST(request, { params: {} } as any);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Missing file in request");
  });

  it("returns 400 when file exceeds 5MB", async () => {
    // Create a blob larger than 5MB using repeated data
    const largeContent = "x".repeat(5 * 1024 * 1024 + 1);
    const formData = new FormData();
    const largeBlob = new Blob([largeContent]);
    formData.append("file", largeBlob, "large.xlsx");

    const request = new NextRequest(
      "http://localhost:3000/api/customers/import",
      {
        method: "POST",
        body: formData,
        headers: { "x-account-id": TEST_ACCOUNT_ID },
      }
    );
    const response = await POST(request, { params: {} } as any);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain("5MB");
  });

  it("returns 400 when no valid rows found", async () => {
    mockParseXlsx.mockReturnValue({
      validRows: [],
      errors: [{ row: 2, message: "Missing name" }],
      totalRows: 1,
    });

    const request = createImportRequest("invalid-data");
    const response = await POST(request, { params: {} } as any);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("No valid rows found");
    expect(json.errors).toHaveLength(1);
  });

  it("returns partial success with insertErrors", async () => {
    const validRows = [
      { fullName: "Khách OK", customerType: "retail" },
      { fullName: "Khách Fail", customerType: "retail" },
    ];
    mockParseXlsx.mockReturnValue({
      validRows,
      errors: [],
      totalRows: 2,
    });

    let callCount = 0;
    mockFrom.mockReturnValue({
      insert: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          return Promise.resolve({
            error: { message: "Duplicate entry" },
          });
        }
        return Promise.resolve({ error: null });
      }),
    });

    const request = createImportRequest("mixed-data");
    const response = await POST(request, { params: {} } as any);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.createdCount).toBe(1);
    expect(json.insertErrors).toHaveLength(1);
    expect(json.insertErrors[0].message).toBe("Duplicate entry");
  });

  it("handles mixed parse errors + valid rows", async () => {
    mockParseXlsx.mockReturnValue({
      validRows: [{ fullName: "Valid", customerType: "retail" }],
      errors: [
        { row: 2, message: "Missing name" },
        { row: 4, message: "Invalid type" },
      ],
      totalRows: 3,
    });

    mockFrom.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    });

    const request = createImportRequest("mixed-data");
    const response = await POST(request, { params: {} } as any);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.createdCount).toBe(1);
    expect(json.skippedCount).toBe(2); // totalRows - validRows
    expect(json.parseErrors).toHaveLength(2);
  });
});
