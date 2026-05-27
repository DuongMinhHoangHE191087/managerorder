"use client";

import { useMemo } from "react";

import {
  calculateExpiryDate,
  calculateRenewalFinanceSnapshot,
  billingCycleFromMonths,
  getBillingCycleLabel,
  getCycleMonths,
  normalizeRenewalCurrency,
  scaleAmountByCycle,
  type PremiumBillingCycle,
} from "@/lib/domain/premium-renewal-finance";
import { formatMoney } from "@/lib/utils";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";

export type RenewalFormValue = {
  productId: string;
  newBillingCycle: PremiumBillingCycle;
  durationMonths: number;
  renewalPrice: number;
  costPrice: number;
  collectedAmount: number;
  notes: string;
};

export type PremiumRenewalProductOption = {
  id: string;
  name: string;
  durationMonths: number;
  sellPriceVnd: number;
  buyPriceVnd: number;
};

export type RenewalDefaultsSource = {
  billingCycle: string;
  cycleMonths: number;
  expiryDate: string;
  currentPrice: number;
  packageDefaultPrice?: number | null;
};

export const PREMIUM_BILLING_CYCLE_OPTIONS: Array<{
  value: PremiumBillingCycle;
  label: string;
}> = [
  { value: "1month", label: "1 tháng" },
  { value: "3months", label: "3 tháng" },
  { value: "6months", label: "6 tháng" },
  { value: "1year", label: "12 tháng" },
];

export function buildRenewalFormDefaults(source: RenewalDefaultsSource): RenewalFormValue {
  const billingCycle = (PREMIUM_BILLING_CYCLE_OPTIONS.find((item) => item.value === source.billingCycle)?.value ??
    "1month") as PremiumBillingCycle;
  const renewalPrice = scaleAmountByCycle(
    source.currentPrice,
    source.cycleMonths,
    billingCycle,
  );
  const costPrice = scaleAmountByCycle(
    source.packageDefaultPrice ?? 0,
    source.cycleMonths,
    billingCycle,
  );

  return {
    productId: "",
    newBillingCycle: billingCycle,
    durationMonths: getCycleMonths(billingCycle),
    renewalPrice,
    costPrice,
    collectedAmount: renewalPrice,
    notes: "",
  };
}

export function PremiumRenewalForm({
  value,
  onChange,
  currentExpiryDate,
  currentCycleMonths,
  currentCycleLabel,
  currentPrice,
  packageDefaultPrice,
  currentPriceLabel,
  productOptions = [],
  isLoadingProducts = false,
}: {
  value: RenewalFormValue;
  onChange: (next: RenewalFormValue) => void;
  currentExpiryDate: string;
  currentCycleMonths: number;
  currentCycleLabel: string;
  currentPrice: number;
  packageDefaultPrice?: number | null;
  currentPriceLabel: string;
  productOptions?: PremiumRenewalProductOption[];
  isLoadingProducts?: boolean;
}) {
  const cycleOptions = useMemo(() => {
    if (PREMIUM_BILLING_CYCLE_OPTIONS.some((option) => option.value === value.newBillingCycle)) {
      return PREMIUM_BILLING_CYCLE_OPTIONS;
    }

    return [
      ...PREMIUM_BILLING_CYCLE_OPTIONS,
      {
        value: value.newBillingCycle,
        label: getBillingCycleLabel(value.newBillingCycle),
      },
    ];
  }, [value.newBillingCycle]);
  const scaledCurrentPrice = useMemo(
    () => scaleAmountByCycle(currentPrice, currentCycleMonths, value.newBillingCycle),
    [currentCycleMonths, currentPrice, value.newBillingCycle],
  );
  const suggestedCostPrice = useMemo(
    () => scaleAmountByCycle(packageDefaultPrice ?? 0, currentCycleMonths, value.newBillingCycle),
    [packageDefaultPrice, currentCycleMonths, value.newBillingCycle],
  );
  const finance = useMemo(
    () =>
      calculateRenewalFinanceSnapshot({
        renewalPrice: value.renewalPrice,
        collectedAmount: value.collectedAmount,
        costPrice: value.costPrice,
      }),
    [value.collectedAmount, value.costPrice, value.renewalPrice],
  );
  const nextExpiryDate = useMemo(
    () => calculateExpiryDate(currentExpiryDate, value.newBillingCycle),
    [currentExpiryDate, value.newBillingCycle],
  );

  function applyBillingCycle(nextBillingCycle: PremiumBillingCycle) {
    onChange({
      ...value,
      productId: "",
      newBillingCycle: nextBillingCycle,
      durationMonths: getCycleMonths(nextBillingCycle),
    });
  }

  function applyDurationMonths(nextDurationMonths: number) {
    const durationMonths = Math.max(1, Math.round(Number(nextDurationMonths) || 1));

    onChange({
      ...value,
      productId: "",
      durationMonths,
      newBillingCycle: billingCycleFromMonths(durationMonths),
    });
  }

  function applyProduct(productId: string) {
    const product = productOptions.find((item) => item.id === productId);

    if (!product) {
      onChange({ ...value, productId: "" });
      return;
    }

    onChange({
      ...value,
      productId: product.id,
      durationMonths: product.durationMonths,
      newBillingCycle: billingCycleFromMonths(product.durationMonths),
      renewalPrice: product.sellPriceVnd,
      costPrice: product.buyPriceVnd,
      collectedAmount: product.sellPriceVnd,
    });
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="grid gap-4">
        <div className="space-y-2">
          <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
            Sản phẩm gia hạn
          </label>
          <Select
            value={value.productId}
            onChange={(event) => applyProduct(event.target.value)}
            disabled={isLoadingProducts}
          >
            <option value="">
              {isLoadingProducts
                ? "Đang tải sản phẩm..."
                : productOptions.length > 0
                  ? "Chọn sản phẩm hoặc nhập tay"
                  : "Chưa có sản phẩm active"}
            </option>
            {productOptions.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} • {product.durationMonths} tháng • {formatMoney(product.sellPriceVnd)}
              </option>
            ))}
          </Select>
          <p className="text-[11px] leading-5 text-[var(--fg-muted)]">
            Chọn sản phẩm để tự điền thời hạn, giá bán, giá vốn; vẫn có thể sửa tay nếu cần.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_160px]">
          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
              Chu kỳ gia hạn
            </label>
            <Select
              value={value.newBillingCycle}
              onChange={(event) =>
                applyBillingCycle(event.target.value as PremiumBillingCycle)
              }
            >
              {cycleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
              Số tháng
            </label>
            <Input
              type="number"
              min={1}
              value={value.durationMonths}
              onChange={(event) => applyDurationMonths(Number(event.target.value))}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <MoneyField
            label="Giá bán gia hạn"
            value={value.renewalPrice}
            onChange={(next) => onChange({ ...value, renewalPrice: next })}
            hint={`Giá hiện tại: ${currentPriceLabel}`}
          />
          <MoneyField
            label="Giá vốn"
            value={value.costPrice}
            onChange={(next) => onChange({ ...value, costPrice: next })}
            hint={packageDefaultPrice ? `Gợi ý từ package: ${formatMoney(suggestedCostPrice)}` : "Cho phép nhập tay nếu nhà cung cấp báo giá mới."}
          />
          <MoneyField
            label="Đã thu"
            value={value.collectedAmount}
            onChange={(next) => onChange({ ...value, collectedAmount: next })}
            hint="Số tiền đã nhận thực tế để ghi nhận doanh thu ngay."
          />
        </div>

        <div className="flex flex-wrap gap-2 rounded-[1.2rem] border border-dashed border-[var(--border-soft)] bg-[var(--surface-light)]/45 p-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              onChange({
                ...value,
                renewalPrice: scaledCurrentPrice,
              })
            }
          >
            Áp giá theo chu kỳ {getBillingCycleLabel(value.newBillingCycle)}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              onChange({
                ...value,
                costPrice: suggestedCostPrice,
              })
            }
          >
            Áp giá vốn gợi ý
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              onChange({
                ...value,
                collectedAmount: value.renewalPrice,
              })
            }
          >
            Thu đủ theo báo giá
          </Button>
        </div>

        <div className="space-y-2">
          <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
            Ghi chú vận hành
          </label>
          <textarea
            value={value.notes}
            onChange={(event) => onChange({ ...value, notes: event.target.value })}
            rows={4}
            placeholder="Ví dụ: khách chuyển khoản trước 50%, còn lại hẹn cuối tuần..."
            className="w-full resize-none rounded-[1rem] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.88)] px-3 py-2 text-[13px] font-medium text-[var(--fg-base)] shadow-sm transition-[background-color,border-color,box-shadow,color,opacity,transform,width] placeholder:text-[var(--fg-muted)]/80 focus-visible:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          />
        </div>
      </div>

      <div className="grid gap-3 rounded-[1.6rem] border border-[var(--border-soft)] bg-[var(--surface-light)]/40 p-4">
        <SummaryCard label="Chu kỳ hiện tại" value={currentCycleLabel} />
        <SummaryCard label="Hạn mới sau gia hạn" value={nextExpiryDate} />
        <SummaryCard label="Doanh thu ghi nhận" value={formatMoney(finance.revenueAmount)} />
        <SummaryCard label="Công nợ còn lại" value={formatMoney(finance.outstandingAmount)} tone={finance.outstandingAmount > 0 ? "warning" : "neutral"} />
        <SummaryCard label="Lợi nhuận" value={formatMoney(finance.profitAmount)} tone={finance.profitAmount >= 0 ? "positive" : "danger"} />
        <SummaryCard
          label="Biên lãi"
          value={finance.marginPercent === null ? "Chưa có doanh thu" : `${finance.marginPercent}%`}
          tone={finance.marginPercent !== null && finance.marginPercent >= 0 ? "positive" : "neutral"}
        />
      </div>
    </div>
  );
}

function MoneyField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
        {label}
      </label>
      <Input
        type="number"
        min={0}
        value={value}
        onChange={(event) => onChange(normalizeRenewalCurrency(event.target.value, 0))}
      />
      {hint ? <p className="text-[11px] leading-5 text-[var(--fg-muted)]">{hint}</p> : null}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "warning" | "danger";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-600"
      : tone === "warning"
        ? "text-amber-600"
        : tone === "danger"
          ? "text-rose-600"
          : "text-[var(--fg-base)]";

  return (
    <div className="rounded-[1.15rem] border border-[var(--border-soft)] bg-white px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">{label}</p>
      <p className={`mt-1 text-[15px] font-black ${toneClass}`}>{value}</p>
    </div>
  );
}
