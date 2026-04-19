"use client";

import { useState, useEffect } from "react";
import { appToast } from "@/shared/ui/app-toast";
import { Percent, Save } from "lucide-react";
import { formatNumber } from "@/lib/utils";

// Store pricing config in localStorage + API settings
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
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3 p-4 bg-white border border-[var(--border-soft)] rounded-xl">
          <h4 className="font-bold text-[14px] text-[var(--fg-base)] flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
            Giảm giá CTV (Cộng tác viên)
          </h4>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="number"
                min={0}
                max={50}
                value={config.ctv_discount_percent}
                onChange={e => setConfig({ ...config, ctv_discount_percent: Number(e.target.value) || 0 })}
                className="w-full border border-[var(--border-soft)] rounded-lg bg-[var(--bg-app)] px-3 py-2.5 text-[15px] font-bold outline-none focus:border-[var(--accent)] pr-10"
              />
              <Percent className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-[var(--fg-muted)]" />
            </div>
            <span className="text-[12px] text-[var(--fg-muted)] whitespace-nowrap">giảm từ giá gốc</span>
          </div>
          <p className="text-[11px] text-[var(--fg-muted)]">
            VD: Giá gốc 10.000đ → CTV: {formatNumber(10000 * (1 - config.ctv_discount_percent / 100))}đ
          </p>
        </div>

        <div className="space-y-3 p-4 bg-white border border-[var(--border-soft)] rounded-xl">
          <h4 className="font-bold text-[14px] text-[var(--fg-base)] flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
            Giảm giá VIP
          </h4>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="number"
                min={0}
                max={50}
                value={config.vip_discount_percent}
                onChange={e => setConfig({ ...config, vip_discount_percent: Number(e.target.value) || 0 })}
                className="w-full border border-[var(--border-soft)] rounded-lg bg-[var(--bg-app)] px-3 py-2.5 text-[15px] font-bold outline-none focus:border-[var(--accent)] pr-10"
              />
              <Percent className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-[var(--fg-muted)]" />
            </div>
            <span className="text-[12px] text-[var(--fg-muted)] whitespace-nowrap">giảm từ giá gốc</span>
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
          className="flex items-center gap-2 px-5 py-2 bg-[var(--accent)] text-white rounded-lg text-[13px] font-bold disabled:opacity-50 hover:bg-[var(--accent)]/90 transition-colors cursor-pointer"
        >
          <Save className="size-3.5" />
          {saving ? "Đang lưu..." : "Lưu cấu hình giá"}
        </button>
      </div>
    </div>
  );
}
