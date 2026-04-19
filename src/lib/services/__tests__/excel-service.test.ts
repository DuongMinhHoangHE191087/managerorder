import { describe, it, expect } from "vitest";
import { generateCustomerXlsx, parseCustomerXlsx } from "../excel-service";
import type { Customer } from "@/lib/domain/types";
import * as XLSX from "xlsx";

/* ─── Helpers ──────────────────────────────────────────────── */
function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: "c1",
    name: "Nguyễn Văn A",
    contacts: [],
    tier: "regular",
    customerType: "retail",
    debtAmountVnd: 0,
    debtOverdueDays: 0,
    reliabilityScore: 100,
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function createImportBuffer(rows: Record<string, unknown>[]): Buffer {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

/* ─── generateCustomerXlsx ─────────────────────────────────── */
describe("generateCustomerXlsx", () => {
  it("returns a valid XLSX buffer", async () => {
    const buf = await generateCustomerXlsx([makeCustomer()]);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);

    // Parse it back to verify structure
    const wb = XLSX.read(buf, { type: "buffer" });
    expect(wb.SheetNames).toContain("Khách hàng");
  });

  it("includes all EXPORT_COLUMNS as headers", async () => {
    const buf = await generateCustomerXlsx([makeCustomer()]);
    const wb = XLSX.read(buf, { type: "buffer" });
    const ws = wb.Sheets["Khách hàng"];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws);
    expect(rows.length).toBe(1);

    // Check key headers exist
    const headers = Object.keys(rows[0]);
    expect(headers).toContain("ID");
    expect(headers).toContain("Tên khách hàng");
    expect(headers).toContain("Loại KH");
  });

  it("maps customer name correctly", async () => {
    const buf = await generateCustomerXlsx([makeCustomer({ name: "Test User" })]);
    const wb = XLSX.read(buf, { type: "buffer" });
    const ws = wb.Sheets["Khách hàng"];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws);
    expect(rows[0]["Tên khách hàng"]).toBe("Test User");
  });

  it("handles empty array", async () => {
    const buf = await generateCustomerXlsx([]);
    expect(buf).toBeInstanceOf(Buffer);
    const wb = XLSX.read(buf, { type: "buffer" });
    const ws = wb.Sheets["Khách hàng"];
    const rows = XLSX.utils.sheet_to_json(ws);
    expect(rows.length).toBe(0);
  });

  it("handles undefined optional fields gracefully", async () => {
    const customer = makeCustomer({ segment: undefined, rfmScore: undefined, notes: undefined });
    const buf = await generateCustomerXlsx([customer]);
    const wb = XLSX.read(buf, { type: "buffer" });
    const ws = wb.Sheets["Khách hàng"];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws);
    // Undefined fields should be empty strings
    expect(rows[0]["Phân khúc"]).toBe("");
  });
});

/* ─── parseCustomerXlsx ───────────────────────────────────── */
describe("parseCustomerXlsx", () => {
  it("parses valid rows", async () => {
    const buf = createImportBuffer([
      { "Tên khách hàng": "Alice", "Loại KH": "retail", "Ghi chú": "VIP" },
      { "Tên khách hàng": "Bob", "Loại KH": "wholesale" },
    ]);

    const result = await parseCustomerXlsx(buf);
    expect(result.totalRows).toBe(2);
    expect(result.validRows.length).toBe(2);
    expect(result.errors.length).toBe(0);
    expect(result.validRows[0].fullName).toBe("Alice");
    expect(result.validRows[0].customerType).toBe("retail");
    expect(result.validRows[1].customerType).toBe("wholesale");
  });

  it("reports error for missing name", async () => {
    const buf = createImportBuffer([
      { "Tên khách hàng": "", "Loại KH": "retail" },
    ]);
    const result = await parseCustomerXlsx(buf);
    expect(result.validRows.length).toBe(0);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].message).toContain("Thiếu tên");
  });

  it("defaults to 'retail' for invalid customer type", async () => {
    const buf = createImportBuffer([
      { "Tên khách hàng": "Test", "Loại KH": "invalid_type" },
    ]);
    const result = await parseCustomerXlsx(buf);
    expect(result.validRows[0].customerType).toBe("retail");
  });

  it("parses numeric fields correctly", async () => {
    const buf = createImportBuffer([
      { "Tên khách hàng": "Test", "Công nợ (VND)": 500000, "Ngày quá hạn": 15, "Điểm uy tín": 85 },
    ]);
    const result = await parseCustomerXlsx(buf);
    expect(result.validRows[0].debtAmountVnd).toBe(500000);
    expect(result.validRows[0].debtOverdueDays).toBe(15);
    expect(result.validRows[0].reliabilityScore).toBe(85);
  });

  it("handles empty file", async () => {
    const ws = XLSX.utils.aoa_to_sheet([]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Empty");
    const buf = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));

    const result = await parseCustomerXlsx(buf);
    expect(result.totalRows).toBe(0);
    expect(result.validRows.length).toBe(0);
  });

  it("handles alternative column name (full_name)", async () => {
    const buf = createImportBuffer([
      { full_name: "Alt Name 1" },
    ]);
    const result = await parseCustomerXlsx(buf);
    expect(result.validRows.length).toBe(1);
    expect(result.validRows[0].fullName).toBe("Alt Name 1");
  });

  it("handles alternative column name (name)", async () => {
    const buf = createImportBuffer([
      { name: "Alt Name 2" },
    ]);
    const result = await parseCustomerXlsx(buf);
    expect(result.validRows.length).toBe(1);
    expect(result.validRows[0].fullName).toBe("Alt Name 2");
  });

  it("mixed valid and invalid rows", async () => {
    const buf = createImportBuffer([
      { "Tên khách hàng": "Good", "Loại KH": "agency" },
      { "Tên khách hàng": "", "Loại KH": "retail" },
      { "Tên khách hàng": "Also Good" },
    ]);
    const result = await parseCustomerXlsx(buf);
    expect(result.validRows.length).toBe(2);
    expect(result.errors.length).toBe(1);
    expect(result.totalRows).toBe(3);
  });
});
