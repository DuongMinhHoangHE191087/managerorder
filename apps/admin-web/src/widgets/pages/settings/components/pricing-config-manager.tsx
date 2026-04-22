"use client";

import { useEffect, useState } from "react";
import { Percent, Save } from "lucide-react";
import { appToast } from "@/shared/ui/app-toast";
import { formatNumber } from "@/lib/utils";

const PRICING_KEY = "po_pricing_config";

interface PricingConfig {
  ctv_discount_percent: number;
  vip_discount_percent: number;
}

const DEFAULT_CONFIG: PricingConfig = {
  ctv_discount_percent: 10,
  vip_discount_percent: 5,
};

export function getPricingConfig(): PricingConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;

  try {
    const saved = localStorage.getItem(PRICING_KEY);
    if (saved) return JSON.parse(saved) as PricingConfig;
  } catch {
    // ignore localStorage parse errors
  }

  return DEFAULT_CONFIG;
}

export function PricingConfigManager() {
  const [config, setConfig] = useState<PricingConfig>(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setConfig(getPricingConfig());
  }, []);

  function handleSave() {
    setSaving(true);
    try {
      localStorage.setItem(PRICING_KEY, JSON.stringify(config));
      appToast.success("Đã lưu cấu hình giá nhập NCC");
    } catch {
      appToast.error("Lỗi lưu cấu hình");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-[var(--border-soft)] bg-white p-4">
          <h4 className="flex items-center gap-2 text-[14px] font-bold text-[var(--fg-base)]">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Giảm giá CTV (Cộng tác viên)
          </h4>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="number"
                min={0}
                max={50}
                value={config.ctv_discount_percent}
                onChange={(event) =>
                  setConfig({ ...config, ctv_discount_percent: Number(event.target.value) || 0 })
                }
                className="w-full rounded-lg border border-[var(--border-soft)] bg-[var(--bg-app)] px-3 py-2.5 pr-10 text-[15px] font-bold outline-none focus:border-[var(--accent)]"
              />
              <Percent className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[var(--fg-muted)]" />
            </div>
            <span className="whitespace-nowrap text-[12px] text-[var(--fg-muted)]">giảm từ giá gốc</span>
          </div>
          <p className="text-[11px] text-[var(--fg-muted)]">
            VD: Giá gốc 10.000đ → CTV: {formatNumber(10000 * (1 - config.ctv_discount_percent / 100))}đ
          </p>
        </div>

        <div className="space-y-3 rounded-xl border border-[var(--border-soft)] bg-white p-4">
          <h4 className="flex items-center gap-2 text-[14px] font-bold text-[var(--fg-base)]">
            <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Giảm giá VIP
          </h4>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="number"
                min={0}
                max={50}
                value={config.vip_discount_percent}
                onChange={(event) =>
                  setConfig({ ...config, vip_discount_percent: Number(event.target.value) || 0 })
                }
                className="w-full rounded-lg border border-[var(--border-soft)] bg-[var(--bg-app)] px-3 py-2.5 pr-10 text-[15px] font-bold outline-none focus:border-[var(--accent)]"
              />
              <Percent className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[var(--fg-muted)]" />
            </div>
            <span className="whitespace-nowrap text-[12px] text-[var(--fg-muted)]">giảm từ giá gốc</span>
          </div>
          <p className="text-[11px] text-[var(--fg-muted)]">
            VD: Giá gốc 10.000đ → VIP: {formatNumber(10000 * (1 - config.vip_discount_percent / 100))}đ
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex cursor-pointer items-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-2 text-[13px] font-bold text-white transition-colors hover:bg-[var(--accent)]/90 disabled:opacity-50"
        >
          <Save className="size-3.5" />
          {saving ? "Đang lưu..." : "Lưu cấu hình giá"}
        </button>
      </div>
    </div>
  );
}
