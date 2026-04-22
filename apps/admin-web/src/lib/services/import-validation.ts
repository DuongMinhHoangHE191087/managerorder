// ============================================================
// IMPORT VALIDATION — Shared between client & server
// Pure functions only — NO server-side imports (supabase, db, etc.)
// ============================================================

import * as z from "zod";
import { formatNumber } from "@/lib/utils";

// ── Schema ────────────────────────────────────────────────────────

const contactEntrySchema = z.object({
  channel: z.string(),
  value: z.string(),
});

export const importOrderSchema = z.object({
  orderCode: z.string().optional(),
  customerName: z.string().min(1, "Thiếu tên khách hàng"),
  customerCode: z.string().optional(),
  customerPhone: z.string().optional(),
  customerEmail: z.string().optional(),
  productName: z.string().min(1, "Thiếu tên sản phẩm"),
  quantity: z.number().default(1),
  totalAmountVnd: z.number().default(0),
  totalPaid: z.number().default(0),
  paymentMethod: z.string().optional().default("Chuyển khoản"),
  salesNote: z.string().optional(),
  duolingoUsername: z.string().optional(),
  duolingoId: z.string().optional(),
  facebookUrl: z.string().optional(),
  ctvName: z.string().optional(),
  sourceUsername: z.string().optional(),
  inviteLink: z.string().optional(),
  idFamily: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  rawPaymentStatus: z.string().optional(),
  normalizedStatus: z.enum(['paid', 'refunded', 'expired', 'pending_payment', 'draft']).optional(),
  _contactChannels: z.array(contactEntrySchema).optional(),
  _contactMethod: z.string().optional(),
  _orderType: z.enum(['ctv', 'retail']).optional(),
  _resolvedCustomerCode: z.string().optional(),
});

export const bulkImportSchema = z.array(importOrderSchema);
export type ImportRecord = z.infer<typeof importOrderSchema>;

// ── Helpers ────────────────────────────────────────────────────────

/** Normalise a string for case-insensitive lookup */
function lc(str: string | undefined | null): string {
  return (str ?? '').toLowerCase().trim();
}

// ── Validation Types ──────────────────────────────────────────────

export interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export interface ValidationWarning {
  row: number;
  field: string;
  message: string;
}

export interface PreValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

// ── Pre-Validation ────────────────────────────────────────────────

/** Pre-validate records BEFORE sending to the RPC */
export function preValidateRecords(records: ImportRecord[]): PreValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const seen = new Map<string, number>(); // fingerprint → first row

  records.forEach((record, idx) => {
    const row = idx + 1;

    // ── Required fields ────────────────────────────────────────
    if (!record.customerName || record.customerName.trim().length === 0) {
      errors.push({ row, field: 'customerName', message: 'Thiếu tên khách hàng' });
    }
    if (!record.productName || record.productName.trim().length === 0) {
      errors.push({ row, field: 'productName', message: 'Thiếu tên sản phẩm' });
    }

    // ── Numeric bounds ─────────────────────────────────────────
    if (record.quantity !== undefined && record.quantity < 0) {
      errors.push({ row, field: 'quantity', message: 'Số lượng không hợp lệ' });
    }
    if (record.totalAmountVnd !== undefined && record.totalAmountVnd < 0) {
      errors.push({ row, field: 'totalAmountVnd', message: 'Tổng tiền không hợp lệ' });
    }
    if (record.totalAmountVnd !== undefined && record.totalAmountVnd > 1_000_000_000) {
      errors.push({ row, field: 'totalAmountVnd', message: 'Tổng tiền vượt giới hạn (>1 tỷ VND)' });
    }

    // ── Phone format ───────────────────────────────────────────
    if (record.customerPhone) {
      const phoneClean = record.customerPhone.replace(/\s/g, '');
      if (!/^[0-9+()-]{8,15}$/.test(phoneClean)) {
        errors.push({ row, field: 'customerPhone', message: 'SĐT không hợp lệ' });
      }
    }

    // ── Email format ───────────────────────────────────────────
    if (record.customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.customerEmail)) {
      errors.push({ row, field: 'customerEmail', message: 'Email không hợp lệ' });
    }

    // ── Date consistency ──────────────────────────────────────
    if (record.startDate && record.endDate) {
      const startMs = new Date(record.startDate).getTime();
      const endMs = new Date(record.endDate).getTime();
      if (!isNaN(startMs) && !isNaN(endMs) && startMs > endMs) {
        errors.push({ row, field: 'endDate', message: 'Ngày kết thúc phải sau ngày bắt đầu' });
      }
    }

    // ── Contact channels ──────────────────────────────────────
    const validChannels = ['phone', 'email', 'zalo', 'facebook', 'telegram', 'other'];
    if (record._contactChannels) {
      record._contactChannels.forEach((ch, chIdx) => {
        if (!validChannels.includes(ch.channel)) {
          errors.push({ row, field: `contact[${chIdx}]`, message: `Kênh liên lạc không hợp lệ: ${ch.channel}` });
        }
      });
    }

    // ── Overpayment check ─────────────────────────────────────
    if (record.totalPaid > 0 && record.totalAmountVnd > 0 && record.totalPaid > record.totalAmountVnd) {
      warnings.push({ row, field: 'totalPaid', message: `Số tiền đã trả (${formatNumber(record.totalPaid)}) vượt tổng tiền (${formatNumber(record.totalAmountVnd)})` });
    }

    // ── Duplicate detection within batch ──────────────────────
    const fingerprint = `${lc(record.customerName)}|${lc(record.productName)}|${record.totalAmountVnd ?? 0}|${record.quantity ?? 1}|${record.startDate || ''}`;
    if (seen.has(fingerprint)) {
      warnings.push({ row, field: '_duplicate', message: `Có thể trùng với dòng ${seen.get(fingerprint)}` });
    } else {
      seen.set(fingerprint, row);
    }
  });

  return { valid: errors.length === 0, errors, warnings };
}
