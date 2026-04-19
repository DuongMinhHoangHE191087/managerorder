// ============================================================
// EXCEL SERVICE — Import/Export customers via workbook helper
// ============================================================

import type { Customer, CustomerSegment } from "@/lib/domain/types";
import * as ExcelJS from "exceljs";
import { loadWorkbook, worksheetToRecords } from "@/lib/utils/excel";

const MAX_IMPORT_ROWS = 1000;

// Vietnamese segment names → enum values
const SEGMENT_MAPPING: Record<string, CustomerSegment> = {
  vip: "vip",
  "trung thành": "loyal",
  "thường": "regular",
  "có rủi ro": "at_risk",
  "at risk": "at_risk",
  "đã rời": "churned",
  churned: "churned",
  mới: "new",
  new: "new",
  loyal: "loyal",
  regular: "regular",
};

// Column mapping: Excel header → DB column name
const EXPORT_COLUMNS = [
  { header: "ID", key: "id" },
  { header: "Tên khách hàng", key: "name" },
  { header: "Loại KH", key: "customerType" },
  { header: "Phân khúc", key: "segment" },
  { header: "Điểm RFM", key: "rfmScore" },
  { header: "R (Gần đây)", key: "rfmRecency" },
  { header: "F (Tần suất)", key: "rfmFrequency" },
  { header: "M (Giá trị)", key: "rfmMonetary" },
  { header: "Công nợ (VND)", key: "debtAmountVnd" },
  { header: "Ngày quá hạn", key: "debtOverdueDays" },
  { header: "Điểm uy tín", key: "reliabilityScore" },
  { header: "Ghi chú", key: "notes" },
  { header: "Ngày tạo", key: "createdAt" },
] as const;

/**
 * Generate XLSX buffer from customer data
 */
export async function generateCustomerXlsx(customers: Customer[]): Promise<Buffer> {
  const rows = customers.map((c) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row: Record<string, any> = {};
    for (const col of EXPORT_COLUMNS) {
      row[col.header] = c[col.key as keyof Customer] ?? "";
    }
    return row;
  });

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Khách hàng");
  worksheet.columns = EXPORT_COLUMNS.map((col) => ({
    header: col.header,
    key: col.header,
    width: Math.max(col.header.length + 2, 15),
  }));

  worksheet.addRows(rows);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
}

/**
 * Parse XLSX buffer and return validated customer import data
 */
export interface ImportedCustomerRow {
  fullName: string;
  customerType: "retail" | "wholesale" | "agency";
  segment?: CustomerSegment;
  notes?: string;
  debtAmountVnd?: number;
  debtOverdueDays?: number;
  reliabilityScore?: number;
}

export interface ImportResult {
  validRows: ImportedCustomerRow[];
  errors: Array<{ row: number; message: string }>;
  totalRows: number;
}

const VALID_CUSTOMER_TYPES = ["retail", "wholesale", "agency"] as const;

export async function parseCustomerXlsx(buffer: Buffer): Promise<ImportResult> {
  const workbook = await loadWorkbook(buffer);
  const worksheet = workbook.worksheets[0];

  if (!worksheet) {
    return { validRows: [], errors: [{ row: 0, message: "File Excel trống" }], totalRows: 0 };
  }
  const rawRows = worksheetToRecords(worksheet);

  // Validate max row limit
  if (rawRows.length > MAX_IMPORT_ROWS) {
    return {
      validRows: [],
      errors: [{ row: 0, message: `File vượt quá ${MAX_IMPORT_ROWS} dòng. Vui lòng chia nhỏ file.` }],
      totalRows: rawRows.length,
    };
  }

  const validRows: ImportedCustomerRow[] = [];
  const errors: Array<{ row: number; message: string }> = [];

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const rowNum = i + 2; // Header is row 1

    // Name is required
    const fullName =
      String(raw["Tên khách hàng"] ?? raw["full_name"] ?? raw["name"] ?? "").trim();
    if (!fullName) {
      errors.push({ row: rowNum, message: "Thiếu tên khách hàng" });
      continue;
    }

    // Customer type
    const rawType = String(
      raw["Loại KH"] ?? raw["customer_type"] ?? raw["type"] ?? "retail",
    )
      .trim()
      .toLowerCase();
    const customerType = VALID_CUSTOMER_TYPES.includes(
      rawType as "retail" | "wholesale" | "agency",
    )
      ? (rawType as "retail" | "wholesale" | "agency")
      : "retail";

    const notes = raw["Ghi chú"] ?? raw["notes"];
    const debtAmountVnd = parseNumberField(raw["Công nợ (VND)"] ?? raw["debt_amount_vnd"]);
    const debtOverdueDays = parseNumberField(raw["Ngày quá hạn"] ?? raw["debt_overdue_days"]);
    const reliabilityScore = parseNumberField(raw["Điểm uy tín"] ?? raw["reliability_score"]);

    // Segment mapping (Vietnamese → enum)
    const rawSegment = String(
      raw["Phân khúc"] ?? raw["segment"] ?? "",
    ).trim().toLowerCase();
    const segment = rawSegment ? SEGMENT_MAPPING[rawSegment] : undefined;

    validRows.push({
      fullName,
      customerType,
      segment,
      notes: notes ? String(notes) : undefined,
      debtAmountVnd: debtAmountVnd ?? undefined,
      debtOverdueDays: debtOverdueDays ?? undefined,
      reliabilityScore: reliabilityScore ?? undefined,
    });
  }

  return { validRows, errors, totalRows: rawRows.length };
}

function parseNumberField(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
}
