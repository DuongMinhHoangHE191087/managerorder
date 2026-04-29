import { describe, it, expect } from "vitest";
import {
  detectHeaderRowIndex,
  fuzzyMatchHeaders,
  excelDateToJSDateString,
  parseVietnameseDateStr,
  parseExcelDate,
  parseDuolingoField,
  parseFacebookUrl,
  normalizePlanName,
  normalizePaymentStatus,
  smartExtractCustomerName,
} from "../parser";

// ── detectHeaderRowIndex ──────────────────────────────────────

describe("detectHeaderRowIndex", () => {
  it("returns 0 for empty data", () => {
    expect(detectHeaderRowIndex([])).toBe(0);
  });

  it("identifies header row with most keyword matches", () => {
    const data = [
      ["Company Logo", "", ""],
      ["", "", ""],
      ["Username", "Tên Khách", "Ngày Mua", "Giá", "Family"],
      ["john123", "John", "01/01/2025", 100, "00000000-0000-4000-8000-00000000014d"],
    ];
    expect(detectHeaderRowIndex(data)).toBe(2);
  });

  it("picks row with highest combined string+keyword score", () => {
    const data = [
      ["Title Row"],
      ["Username", "Name", "Date", "Price", "Note", "Status"],
    ];
    expect(detectHeaderRowIndex(data)).toBe(1);
  });

  it("handles rows with null cells", () => {
    const data = [
      [null, null, null],
      ["Tên", "Ngày", "Tiền"],
    ];
    expect(detectHeaderRowIndex(data)).toBe(1);
  });
});

// ── fuzzyMatchHeaders ─────────────────────────────────────────

describe("fuzzyMatchHeaders", () => {
  it("matches exact Vietnamese headers", () => {
    const headers = ["Tên Khách Hàng", "Số Điện Thoại", "Tên Sản Phẩm"];
    const mapping = fuzzyMatchHeaders(headers);
    expect(mapping.customerName).toBe(0);
    expect(mapping.customerPhone).toBe(1);
    expect(mapping.productName).toBe(2);
  });

  it("matches alias headers", () => {
    const headers = ["khách hàng", "ghi chú", "gói"];
    const mapping = fuzzyMatchHeaders(headers);
    expect(mapping.customerName).toBe(0);
    expect(mapping.salesNote).toBe(1);
    expect(mapping.productName).toBe(2);
  });

  it("returns empty mapping for unrecognized headers", () => {
    const headers = ["xyz123", "abc456"];
    const mapping = fuzzyMatchHeaders(headers);
    expect(Object.keys(mapping).length).toBe(0);
  });
});

// ── excelDateToJSDateString ───────────────────────────────────

describe("excelDateToJSDateString", () => {
  it("converts valid Excel serial to ISO date", () => {
    // 44927 = 2023-01-01 in Excel
    const result = excelDateToJSDateString(44927);
    expect(result).toBeDefined();
    expect(result).toContain("2023");
  });

  it("returns undefined for NaN", () => {
    expect(excelDateToJSDateString(NaN)).toBeUndefined();
  });

  it("returns undefined for 0", () => {
    expect(excelDateToJSDateString(0)).toBeUndefined();
  });

  it("returns undefined for out-of-range dates", () => {
    expect(excelDateToJSDateString(1)).toBeUndefined(); // Way before 2010
    expect(excelDateToJSDateString(999999)).toBeUndefined(); // Way after 2050
  });
});

// ── parseVietnameseDateStr ────────────────────────────────────

describe("parseVietnameseDateStr", () => {
  it("parses DD/MM/YYYY format", () => {
    const result = parseVietnameseDateStr("15/06/2025");
    expect(result).toBeDefined();
    expect(result).toContain("2025");
  });

  it("parses D/M/YYYY format", () => {
    const result = parseVietnameseDateStr("1/1/2025");
    expect(result).toBeDefined();
  });

  it("returns undefined for invalid format", () => {
    expect(parseVietnameseDateStr("2025-06-15")).toBeUndefined();
    expect(parseVietnameseDateStr("not-a-date")).toBeUndefined();
    expect(parseVietnameseDateStr("")).toBeUndefined();
  });
});

// ── parseExcelDate ────────────────────────────────────────────

describe("parseExcelDate", () => {
  it("handles number input (Excel serial)", () => {
    const result = parseExcelDate(44927);
    expect(result).toBeDefined();
  });

  it("handles string input (Vietnamese format)", () => {
    const result = parseExcelDate("01/01/2025");
    expect(result).toBeDefined();
  });

  it("returns undefined for null/undefined", () => {
    expect(parseExcelDate(null)).toBeUndefined();
    expect(parseExcelDate(undefined)).toBeUndefined();
  });
});

// ── parseDuolingoField ────────────────────────────────────────

describe("parseDuolingoField", () => {
  it("parses 'Username: X ID: Y' format", () => {
    const result = parseDuolingoField("Username: SnDng451816 ID: 1270083294");
    expect(result.username).toBe("SnDng451816");
    expect(result.duolingoId).toBe("1270083294");
  });

  it("returns plain string as username when no pattern", () => {
    const result = parseDuolingoField("simpleuser123");
    expect(result.username).toBe("simpleuser123");
    expect(result.duolingoId).toBe("");
  });

  it("handles empty/null input", () => {
    const result = parseDuolingoField("");
    expect(result.username).toBe("");
    expect(result.duolingoId).toBe("");
  });
});

// ── parseFacebookUrl ──────────────────────────────────────────

describe("parseFacebookUrl", () => {
  it("detects Facebook URL", () => {
    const result = parseFacebookUrl("https://www.facebook.com/profile");
    expect(result.isFbUrl).toBe(true);
    expect(result.url).toContain("facebook.com");
  });

  it("detects http Facebook URL", () => {
    const result = parseFacebookUrl("http://facebook.com/user123");
    expect(result.isFbUrl).toBe(true);
  });

  it("returns false for non-FB URLs", () => {
    const result = parseFacebookUrl("https://google.com");
    expect(result.isFbUrl).toBe(false);
  });

  it("handles empty input", () => {
    const result = parseFacebookUrl("");
    expect(result.isFbUrl).toBe(false);
    expect(result.url).toBe("");
  });
});

// ── normalizePlanName ─────────────────────────────────────────

describe("normalizePlanName", () => {
  it("converts to lowercase slug", () => {
    expect(normalizePlanName("Duolingo Plus 1 Tháng")).toBe("duolingo-plus-1-tháng");
  });

  it("handles multiple spaces", () => {
    expect(normalizePlanName("A   B  C")).toBe("a-b-c");
  });

  it("trims whitespace", () => {
    expect(normalizePlanName("  Hello World  ")).toBe("hello-world");
  });

  it("returns empty for empty input", () => {
    expect(normalizePlanName("")).toBe("");
  });
});

// ── normalizePaymentStatus ────────────────────────────────────

describe("normalizePaymentStatus", () => {
  it("maps 'Đã thanh toán' to paid", () => {
    expect(normalizePaymentStatus("Đã thanh toán")).toBe("paid");
  });

  it("maps 'paid' to paid", () => {
    expect(normalizePaymentStatus("paid")).toBe("paid");
  });

  it("maps 'Không gia hạn' to expired", () => {
    expect(normalizePaymentStatus("Không gia hạn")).toBe("expired");
  });

  it("maps 'Cancel' to refunded", () => {
    expect(normalizePaymentStatus("Cancel")).toBe("refunded");
  });

  it("maps 'Chờ thanh toán' to pending_payment", () => {
    expect(normalizePaymentStatus("Chờ thanh toán")).toBe("pending_payment");
  });

  it("defaults to draft for unknown status", () => {
    expect(normalizePaymentStatus("random text")).toBe("draft");
  });

  it("defaults to draft for null/undefined", () => {
    expect(normalizePaymentStatus(null)).toBe("draft");
    expect(normalizePaymentStatus(undefined)).toBe("draft");
  });
});

// ── smartExtractCustomerName ──────────────────────────────────

describe("smartExtractCustomerName", () => {
  it("returns trimmed name for regular text", () => {
    expect(smartExtractCustomerName("  John Doe  ")).toBe("John Doe");
  });

  it("returns undefined for Facebook URL", () => {
    expect(smartExtractCustomerName("https://www.facebook.com/user")).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(smartExtractCustomerName("")).toBeUndefined();
  });
});
