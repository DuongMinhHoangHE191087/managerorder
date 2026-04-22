import type { CellValue, Worksheet } from "exceljs";

export type ExcelSource = ArrayBuffer | Uint8Array;

async function loadExcelJs() {
  const exceljsModule = await import("exceljs");
  return exceljsModule.default ?? exceljsModule;
}

function toArrayBuffer(source: ExcelSource): ArrayBuffer {
  if (source instanceof ArrayBuffer) {
    return source;
  }

  const bytes = new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
  return bytes.slice().buffer;
}

function normalizeCellValue(value: CellValue): unknown {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeCellValue(item as CellValue));
  }

  if (typeof value === "object") {
    const richText = (value as { richText?: Array<{ text: string }> }).richText;
    if (Array.isArray(richText)) {
      return richText.map((part) => part.text).join("");
    }

    const text = (value as { text?: string }).text;
    if (typeof text === "string") {
      return text;
    }

    if ("result" in value) {
      return normalizeCellValue((value as { result?: CellValue }).result ?? "");
    }
  }

  return value;
}

export async function loadWorkbook(source: ExcelSource) {
  const ExcelJS = await loadExcelJs();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(toArrayBuffer(source));
  return workbook;
}

export function worksheetToMatrix(worksheet: Worksheet): unknown[][] {
  const rows: unknown[][] = [];
  const columnCount = Math.max(worksheet.columnCount, worksheet.getRow(1).cellCount);

  for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const values = Array.from({ length: columnCount }, (_, columnIndex) =>
      normalizeCellValue(row.getCell(columnIndex + 1).value as CellValue)
    );
    rows.push(values);
  }

  return rows;
}

export function worksheetToRecords(worksheet: Worksheet): Record<string, unknown>[] {
  if (worksheet.rowCount === 0) {
    return [];
  }

  const headers = worksheetToMatrix(worksheet)[0] ?? [];
  const normalizedHeaders = headers.map((header, index) => {
    const text =
      header instanceof Date
        ? header.toISOString()
        : typeof header === "string"
          ? header.trim()
          : String(header ?? "").trim();
    return text || `Column ${index + 1}`;
  });

  const records: Record<string, unknown>[] = [];
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const record: Record<string, unknown> = {};
    let hasValue = false;

    normalizedHeaders.forEach((header, columnIndex) => {
      const value = normalizeCellValue(row.getCell(columnIndex + 1).value as CellValue);
      record[header] = value;
      if (value !== "" && value !== null && value !== undefined) {
        hasValue = true;
      }
    });

    if (hasValue) {
      records.push(record);
    }
  }

  return records;
}
