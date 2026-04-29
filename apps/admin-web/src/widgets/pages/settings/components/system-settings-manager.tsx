"use client";

import { useEffect, useState } from "react";
import { appToast } from "@/shared/ui/app-toast";
import { Input } from "@/shared/ui/input";
import { CreateActionFooter, CreateFormSection } from "@/shared/ui/create-flow-shell";
import type { SystemSettings } from "@/lib/domain/types";
import { DEFAULT_SYSTEM_SETTINGS } from "@/lib/settings/system-settings";
import { useSystemSettings, useUpdateSystemSettings } from "@/widgets/pages/settings/hooks/use-settings";

export function SystemSettingsManager() {
  const { data, isLoading } = useSystemSettings();
  const { mutateAsync: updateSettings } = useUpdateSystemSettings();

  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SYSTEM_SETTINGS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setSettings(data);
    }
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
    return <div className="animate-pulse py-4 text-center text-[13px] text-[var(--fg-muted)]">Đang tải...</div>;
  }

  return (
    <div className="space-y-4">
      <CreateFormSection
        title="Thông tin hoá đơn và thuế"
        description="Các trường ở đây là nguồn sự thật cho invoice print, mã thuế và prefix chứng từ."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <Field
            label="Tên công ty xuất hoá đơn"
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
            label="Địa chỉ công ty"
            value={settings.company_address}
            onChange={(company_address) => setSettings({ ...settings, company_address })}
            placeholder="Quận 1, TP.HCM..."
          />
          <Field
            label="Invoice prefix"
            value={settings.invoice_prefix}
            onChange={(invoice_prefix) => setSettings({ ...settings, invoice_prefix })}
            placeholder="INV"
          />
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
      </CreateFormSection>

      <CreateFormSection
        title="Thanh toán và hướng dẫn chuyển khoản"
        description="Các mẫu này được dùng lại cho QR, invoice và các flow thu tiền nội bộ."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <Field
            label="Chủ tài khoản / người đại diện"
            value={settings.personal_name}
            onChange={(personal_name) => setSettings({ ...settings, personal_name })}
            placeholder="NGUYEN VAN A"
          />
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
          <Field
            label="Ghi chú chân trang mặc định"
            value={settings.default_notes}
            onChange={(default_notes) => setSettings({ ...settings, default_notes })}
            placeholder="Cảm ơn quý khách..."
          />
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <TextAreaField
            label="Mẫu hướng dẫn thanh toán"
            value={settings.payment_instruction_template}
            onChange={(payment_instruction_template) =>
              setSettings({ ...settings, payment_instruction_template })
            }
            placeholder={"Ngân hàng: {{bank_name}}\nSố tài khoản: {{bank_account}}\nChủ tài khoản: {{account_name}}\n{{transfer_line}}"}
          />
          <TextAreaField
            label="Mẫu copy chuyển khoản legacy"
            value={settings.qr_transfer_content || ""}
            onChange={(qr_transfer_content) => setSettings({ ...settings, qr_transfer_content })}
            placeholder="Nội dung fallback cho chu kỳ tương thích"
          />
        </div>
      </CreateFormSection>

      <CreateFormSection
        title="Locale và định dạng"
        description="Formatter cho UI, API và invoice sẽ ưu tiên các giá trị này thay vì khoá cứng theo một locale duy nhất."
      >
        <div className="grid gap-4 xl:grid-cols-3">
          <Field
            label="Tiền tệ mặc định"
            value={settings.default_currency}
            onChange={(default_currency) =>
              setSettings({ ...settings, default_currency: default_currency.toUpperCase() })
            }
            placeholder="VND"
          />
          <Field
            label="Locale"
            value={settings.locale}
            onChange={(locale) => setSettings({ ...settings, locale })}
            placeholder="vi-VN"
          />
          <Field
            label="Timezone"
            value={settings.timezone}
            onChange={(timezone) => setSettings({ ...settings, timezone })}
            placeholder="Asia/Ho_Chi_Minh"
          />
        </div>
        <div className="rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--bg-app)] px-4 py-4 text-[13px] leading-6 text-[var(--fg-muted)]">
          Dữ liệu tài chính hiện vẫn lưu ở VND trong database, nhưng cách hiển thị ở dashboard, invoice và public surfaces giờ ưu tiên theo bộ cấu hình này.
        </div>
      </CreateFormSection>

      <div className="rounded-[28px] border border-[var(--border-soft)] bg-white px-5 py-4">
        <CreateActionFooter
          primaryLabel="Lưu thay đổi"
          onPrimary={() => {
            void handleSave();
          }}
          pending={saving}
        />
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
    <div className="space-y-2">
      <label className="block text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">
        {label}
      </label>
      <Input
        type={type}
        className="h-11"
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
    <div className="space-y-2">
      <label className="block text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">
        {label}
      </label>
      <textarea
        className="min-h-[140px] w-full rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-3 text-[13px] font-medium text-[var(--fg-base)] outline-none transition-colors placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
