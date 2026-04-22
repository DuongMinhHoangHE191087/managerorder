"use client";

import { useState } from "react";
import {
  Bell,
  BellOff,
  Mail,
  MessageCircle,
  MessageSquare,
  Save,
  Send,
  Zap,
} from "lucide-react";
import { appToast } from "@/shared/ui/app-toast";
import type { ReminderChannel, ReminderConfig } from "@/lib/domain/types";
import { useReminderConfig, useUpdateReminderConfig } from "@/widgets/pages/settings/hooks/use-settings";

const DEFAULT_CONFIG: ReminderConfig = {
  t7_enabled: true,
  t3_enabled: true,
  t1_enabled: true,
  channel: "telegram",
  template_renewal:
    "Xin chào {customer_name}, dịch vụ {product_name} sẽ hết hạn vào {expiry_date}. Vui lòng gia hạn sớm!",
  template_debt:
    "Xin chào {customer_name}, bạn đang có công nợ {debt_amount} cần thanh toán trước {due_date}.",
  template_renewal_internal:
    "🔔 Nhắc hạn đơn {order_code}\nKhách hàng: {customer_name}\nSản phẩm: {product_name}\nHết hạn: {expiry_date}\nCòn {days_left} ngày\nCòn nợ: {balance_due}",
  template_renewal_zalo:
    "Xin chào {customer_name}, dịch vụ {product_name} sẽ hết hạn vào {expiry_date}. Vui lòng gia hạn sớm để tránh gián đoạn.",
  template_expired_zalo:
    "Xin chào {customer_name}, dịch vụ {product_name} đã hết hạn vào {expiry_date}. Nếu cần tiếp tục sử dụng, bạn vui lòng nhắn lại để được hỗ trợ gia hạn.",
  auto_send: false,
};

const CHANNEL_OPTIONS: Array<{
  value: ReminderChannel;
  label: string;
  icon: typeof MessageSquare;
  description: string;
}> = [
  { value: "telegram", label: "Telegram nội bộ", icon: MessageSquare, description: "Gửi cho admin / vận hành" },
  { value: "zalo", label: "Zalo khách hàng", icon: MessageCircle, description: "Gửi trực tiếp khách đã match" },
  { value: "email", label: "Email", icon: Mail, description: "Giữ chỗ cho phase email" },
  { value: "both", label: "Telegram + Zalo", icon: Zap, description: "Nội bộ và khách hàng cùng lúc" },
];

const REMINDER_DAYS = [
  { key: "t7_enabled" as const, label: "T-7", desc: "7 ngày trước hạn" },
  { key: "t3_enabled" as const, label: "T-3", desc: "3 ngày trước hạn" },
  { key: "t1_enabled" as const, label: "T-1", desc: "1 ngày trước hạn" },
];

const TEMPLATE_VARS = [
  "{customer_name}",
  "{product_name}",
  "{expiry_date}",
  "{days_left}",
  "{balance_due}",
  "{debt_amount}",
  "{due_date}",
  "{order_code}",
  "{order_status}",
];

export function ReminderConfigManager() {
  const { data, isLoading } = useReminderConfig();
  const { mutateAsync: updateConfig, isPending: saving } = useUpdateReminderConfig();

  if (isLoading) {
    return <div className="py-8 text-center text-[13px] text-[var(--fg-muted)] animate-pulse">Đang tải cấu hình nhắc hạn...</div>;
  }

  const initialConfig = data ? { ...DEFAULT_CONFIG, ...data } : DEFAULT_CONFIG;

  return (
    <ReminderConfigForm
      key={data ? "loaded" : "default"}
      initialConfig={initialConfig}
      saving={saving}
      saveConfig={updateConfig}
    />
  );
}

function ReminderConfigForm({
  initialConfig,
  saving,
  saveConfig,
}: {
  initialConfig: ReminderConfig;
  saving: boolean;
  saveConfig: (config: ReminderConfig) => Promise<unknown>;
}) {
  const [config, setConfig] = useState<ReminderConfig>(initialConfig);
  const [testSending, setTestSending] = useState(false);

  function updateField<K extends keyof ReminderConfig>(key: K, val: ReminderConfig[K]) {
    setConfig((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSave() {
    try {
      await saveConfig(config);
      appToast.success("Đã lưu cấu hình nhắc hạn");
    } catch {
      appToast.error("Lưu cấu hình thất bại");
    }
  }

  async function handleTestSend() {
    setTestSending(true);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    setTestSending(false);
    appToast.success("Đã render template test", {
      description: `Kênh hiện tại: ${config.channel}`,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h4 className="mb-3 flex items-center gap-2 text-[13px] font-bold text-[var(--fg-base)]">
          <Bell className="size-4 text-[var(--accent)]" />
          Lịch nhắc
        </h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {REMINDER_DAYS.map((day) => {
            const enabled = config[day.key];
            return (
              <button
                type="button"
                key={day.key}
                onClick={() => updateField(day.key, !enabled)}
                aria-pressed={enabled}
                className={[
                  "rounded-2xl border-2 p-4 text-left transition-all duration-300",
                  enabled
                    ? "border-[var(--accent)] bg-[var(--accent)]/5 shadow-sm"
                    : "border-[var(--border-soft)] bg-white opacity-70",
                ].join(" ")}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span
                    className={enabled ? "text-2xl font-black text-[var(--accent)]" : "text-2xl font-black text-[var(--fg-muted)]"}
                  >
                    {day.label}
                  </span>
                  <div
                    className={`flex h-6 w-10 items-center rounded-full p-0.5 transition-colors duration-300 ${
                      enabled ? "bg-[var(--accent)]" : "bg-gray-300"
                    }`}
                  >
                    <div
                      className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-300 ease-out ${
                        enabled ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </div>
                </div>
                <p className="text-[11px] font-medium text-[var(--fg-muted)]">{day.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h4 className="mb-3 flex items-center gap-2 text-[13px] font-bold text-[var(--fg-base)]">
          <Send className="size-4 text-[var(--accent)]" />
          Kênh gửi
        </h4>
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-4">
          {CHANNEL_OPTIONS.map((channel) => {
            const active = config.channel === channel.value;
            const Icon = channel.icon;
            return (
              <button
                key={channel.value}
                onClick={() => updateField("channel", channel.value)}
                className={[
                  "rounded-2xl border px-4 py-3 text-left transition-all",
                  active
                    ? "border-[var(--accent)] bg-[var(--accent)] text-white shadow-md shadow-[var(--accent)]/20"
                    : "border-[var(--border-soft)] bg-white text-[var(--fg-muted)] hover:border-[var(--accent)]/40",
                ].join(" ")}
              >
                <div className="mb-2 flex items-center gap-2 text-[12px] font-bold">
                  <Icon className="size-4" />
                  {channel.label}
                </div>
                <p className={active ? "text-[11px] text-white/90" : "text-[11px]"}>{channel.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-[var(--border-soft)] bg-white p-4">
        <div className="flex items-center gap-3">
          {config.auto_send ? <Zap className="size-5 text-amber-500" /> : <BellOff className="size-5 text-[var(--fg-muted)]" />}
          <div>
            <p className="text-[13px] font-bold text-[var(--fg-base)]">Tự động gửi cho khách</p>
            <p className="text-[11px] text-[var(--fg-muted)]">
              Chỉ áp dụng khi có Zalo contact đã match với khách hàng và bật auto reminder.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => updateField("auto_send", !config.auto_send)}
          aria-pressed={config.auto_send}
          className={`flex h-7 w-12 items-center rounded-full p-0.5 transition-colors duration-300 ${
            config.auto_send ? "bg-amber-500" : "bg-gray-300"
          }`}
        >
          <div
            className={`h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-300 ease-out ${
              config.auto_send ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      <div className="space-y-4">
        <h4 className="flex items-center gap-2 text-[13px] font-bold text-[var(--fg-base)]">
          <MessageSquare className="size-4 text-[var(--accent)]" />
          Template tin nhắn
        </h4>

        <div className="flex flex-wrap gap-1.5">
          {TEMPLATE_VARS.map((variable) => (
            <button
              key={variable}
              onClick={() => {
                navigator.clipboard.writeText(variable);
                appToast.info(`Đã copy: ${variable}`);
              }}
              className="rounded-lg bg-[var(--accent)]/10 px-2.5 py-1 text-[10px] font-bold text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/20"
            >
              {variable}
            </button>
          ))}
        </div>

        <TemplateField
          label="Telegram nội bộ"
          description="Dùng cho admin / vận hành khi cron gửi cảnh báo nội bộ."
          value={config.template_renewal_internal}
          onChange={(value) => updateField("template_renewal_internal", value)}
        />

        <TemplateField
          label="Zalo gia hạn"
          description="Gửi cho khách hàng khi còn 7/3/1 ngày."
          value={config.template_renewal_zalo}
          onChange={(value) => updateField("template_renewal_zalo", value)}
        />

        <TemplateField
          label="Zalo hết hạn"
          description="Gửi khi đơn đã hết hạn và có contact Zalo đã match."
          value={config.template_expired_zalo}
          onChange={(value) => updateField("template_expired_zalo", value)}
        />

        <TemplateField
          label="Template tương thích cũ"
          description="Giữ lại cho các luồng cũ đang đọc template renewal/debt."
          value={config.template_renewal}
          onChange={(value) => updateField("template_renewal", value)}
        />

        <TemplateField
          label="Template công nợ"
          description="Dùng cho các luồng debt/follow-up hiện hữu."
          value={config.template_debt}
          onChange={(value) => updateField("template_debt", value)}
        />
      </div>

      <div className="flex items-center justify-between border-t border-[var(--border-soft)] pt-2">
        <button
          onClick={handleTestSend}
          disabled={testSending}
          className="flex items-center gap-2 rounded-xl border border-[var(--border-soft)] px-4 py-2.5 text-[12px] font-bold text-[var(--fg-muted)] transition-all hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
        >
          <Send className="size-3.5" />
          {testSending ? "Đang render..." : "Render test"}
        </button>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-[var(--accent)] px-6 py-2.5 text-[13px] font-bold text-white shadow-md shadow-[var(--accent)]/20 transition-all hover:opacity-90 disabled:opacity-50"
        >
          <Save className="size-4" />
          {saving ? "Đang lưu..." : "Lưu cấu hình"}
        </button>
      </div>
    </div>
  );
}

function TemplateField({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">{label}</label>
      <p className="mb-2 text-[11px] text-[var(--fg-muted)]">{description}</p>
      <textarea
        rows={4}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full resize-none rounded-xl border border-[var(--border-soft)] bg-white px-4 py-3 text-[13px] font-medium outline-none transition-all focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15"
      />
    </div>
  );
}
