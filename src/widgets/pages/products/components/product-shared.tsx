/**
 * Shared constants and components for product create/edit modals.
 * Extracted to avoid duplication between ProductCreateModal and ProductEditModal.
 */

import { formatMoney } from "@/lib/utils";

/* ─── Mode Options ───────────────────────────────────────────── */
export const PRODUCT_MODE_OPTIONS = [
  { value: "slot", label: "Slot", desc: "Chia slot tài khoản gia đình" },
  { value: "key", label: "Key", desc: "License key riêng lẻ" },
  { value: "hybrid", label: "Hybrid", desc: "Kết hợp slot + key" },
] as const;

/* ─── Margin Calculation ─────────────────────────────────────── */
export function calculateMarginPercent(buyPrice: string, sellPrice: string): number | null {
  const buy = Number(buyPrice);
  const sell = Number(sellPrice);
  if (!sellPrice || sell <= 0) return null;
  return Math.round(((sell - buy) / sell) * 100);
}

/* ─── Margin Preview Component ───────────────────────────────── */
export function MarginPreview({ buyPrice, sellPrice }: { buyPrice: string; sellPrice: string }) {
  const margin = calculateMarginPercent(buyPrice, sellPrice);
  if (margin === null) return null;

  const colorClass = margin >= 30
    ? "border-[var(--accent)]/30 bg-[var(--accent)]/5 text-[var(--accent)]"
    : margin >= 10
    ? "border-[var(--warning)]/30 bg-[var(--warning)]/5 text-[var(--warning)]"
    : "border-[var(--danger)]/30 bg-[var(--danger)]/5 text-[var(--danger)]";

  return (
    <div className={`px-4 py-2.5 rounded-xl border text-[12px] font-bold flex items-center justify-between ${colorClass}`}>
      <span>Lợi nhuận ước tính:</span>
      <span>{margin}% / {formatMoney(Number(sellPrice) - Number(buyPrice))}</span>
    </div>
  );
}
