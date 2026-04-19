"use client";

import { useState, useEffect } from "react";
import { appToast } from "@/shared/ui/app-toast";
import type { SystemSettings } from "@/lib/domain/types";
import { useSystemSettings, useUpdateSystemSettings } from "@/widgets/pages/settings/hooks/use-settings";
import { DEFAULT_SYSTEM_SETTINGS } from "@/lib/settings/system-settings";

export function SystemSettingsManager() {
  const { data, isLoading } = useSystemSettings();
  const { mutateAsync: updateSettings } = useUpdateSystemSettings();

  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SYSTEM_SETTINGS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setSettings(data);
  }, [data]);

  async function handleSave() {
    setSaving(true);
    try {
      await updateSettings(settings);
      appToast.success("Đã lưu cấu hình hệ thống");
    } catch (error) {
      appToast.error(error instanceof Error ? error.message : "Lỗi khi lưu cấu hình");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return <div className="py-4 text-center text-[13px] text-[var(--fg-muted)] animate-pulse">Đang tải...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="space-y-3 p-4 bg-white border border-[var(--border-soft)] rounded-xl">
          <h4 className="font-bold text-[14px] text-[var(--fg-base)] flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Thông tin hóa đơn & thuế
          </h4>
          <Field
            label="Tên công ty xuất hóa đơn"
            value={settings.company_name}
            onChange={(company_name) => setSettings({ ...settings, company_name })}
            placeholder="CÔNG TY TNHH ABC"
          />
          <Field
            label="Mã số thuế"
            value={settings.tax_id}
            onChange={(tax_id) => setSettings({ ...settings, tax_id })}
            placeholder="03120..."
          />
          <Field
            label="Địa chỉ"
            value={settings.company_address}
            onChange={(company_address) => setSettings({ ...settings, company_address })}
            placeholder="Quận 1, TP.HCM..."
          />
          <Field
            label="Invoice Prefix"
            value={settings.invoice_prefix}
            onChange={(invoice_prefix) => setSettings({ ...settings, invoice_prefix })}
            placeholder="INV"
          />
          <div className="grid grid-cols-2 gap-2">
            <Field
              label="Nhãn thuế"
              value={settings.tax_label}
              onChange={(tax_label) => setSettings({ ...settings, tax_label })}
              placeholder="VAT"
            />
            <Field
              label="Thuế mặc định (%)"
              type="number"
              value={String(settings.tax_rate_default)}
              onChange={(value) => setSettings({ ...settings, tax_rate_default: Number(value || 0) })}
              placeholder="0"
            />
          </div>
        </div>

        <div className="space-y-3 p-4 bg-white border border-[var(--border-soft)] rounded-xl">
          <h4 className="font-bold text-[14px] text-[var(--fg-base)] flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Thanh toán & hướng dẫn
          </h4>
          <Field
            label="Chủ tài khoản / người đại diện"
            value={settings.personal_name}
            onChange={(personal_name) => setSettings({ ...settings, personal_name })}
            placeholder="NGUYEN VAN A"
          />
          <div className="grid grid-cols-2 gap-2">
            <Field
              label="Ngân hàng"
              value={settings.bank_name}
              onChange={(bank_name) => setSettings({ ...settings, bank_name })}
              placeholder="MB Bank"
            />
            <Field
              label="Số tài khoản"
              value={settings.bank_account}
              onChange={(bank_account) => setSettings({ ...settings, bank_account })}
              placeholder="0123456789"
            />
          </div>
          <Field
            label="Ghi chú chân trang mặc định"
            value={settings.default_notes}
            onChange={(default_notes) => setSettings({ ...settings, default_notes })}
            placeholder="Cảm ơn quý khách..."
          />
          <TextAreaField
            label="Mẫu hướng dẫn thanh toán"
            value={settings.payment_instruction_template}
            onChange={(payment_instruction_template) => setSettings({ ...settings, payment_instruction_template })}
            placeholder={"Ngân hàng: {{bank_name}}\nSố tài khoản: {{bank_account}}\nChủ tài khoản: {{account_name}}\n{{transfer_line}}"}
          />
          <TextAreaField
            label="Mẫu copy chuyển khoản legacy"
            value={settings.qr_transfer_content || ""}
            onChange={(qr_transfer_content) => setSettings({ ...settings, qr_transfer_content })}
            placeholder="Nội dung fallback cho chu kỳ tương thích"
          />
        </div>

        <div className="space-y-3 p-4 bg-white border border-[var(--border-soft)] rounded-xl">
          <h4 className="font-bold text-[14px] text-[var(--fg-base)] flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
            Locale & định dạng
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <Field
              label="Tiền tệ mặc định"
              value={settings.default_currency}
              onChange={(default_currency) => setSettings({ ...settings, default_currency: default_currency.toUpperCase() })}
              placeholder="VND"
            />
            <Field
              label="Locale"
              value={settings.locale}
              onChange={(locale) => setSettings({ ...settings, locale })}
              placeholder="vi-VN"
            />
          </div>
          <Field
            label="Timezone"
            value={settings.timezone}
            onChange={(timezone) => setSettings({ ...settings, timezone })}
            placeholder="Asia/Ho_Chi_Minh"
          />
          <div className="rounded-lg border border-dashed border-[var(--border-soft)] px-3 py-3 text-[12px] text-[var(--fg-muted)] bg-[var(--bg-app)]">
            Các formatter API/UI sẽ ưu tiên theo ba giá trị này. Chu kỳ hiện tại vẫn lưu giá bằng VND, nhưng giao diện và hóa đơn đã không còn khóa cứng vào `vi-VN`.
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-[var(--accent)] text-white rounded-lg text-[13px] font-bold disabled:opacity-50 hover:bg-[var(--accent)]/90 transition-colors"
        >
          {saving ? "Đang lưu..." : "Lưu thay đổi"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-[var(--fg-muted)] mb-1">{label}</label>
      <input
        type={type}
        className="w-full border border-[var(--border-soft)] rounded-lg bg-[var(--bg-app)] px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-[var(--fg-muted)] mb-1">{label}</label>
      <textarea
        className="w-full border border-[var(--border-soft)] rounded-lg bg-[var(--bg-app)] px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)] min-h-[120px]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
