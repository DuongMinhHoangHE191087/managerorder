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
  telegram_notifications_enabled: true,
  webhook_notifications_enabled: true,
  template_share_link: "Xin chào {customer_name}, đây là liên kết nhận tài khoản {product_name} của bạn: {share_link}",
  template_share_account: "Thông tin tài khoản {product_name} của bạn:\nEmail: {email}\nMật khẩu: {password}\n2FA: {totp_code}",
};

const CHANNEL_OPTIONS: Array<{
  value: ReminderChannel;
  label: string;
  icon: typeof MessageSquare;
  description: string;
}> = [
  { value: "telegram", label: "Telegram", icon: MessageSquare, description: "Gửi cảnh báo và thông báo" },
  { value: "email", label: "Email", icon: Mail, description: "Gửi qua email khách hàng" },
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
  "{share_link}",
  "{email}",
  "{password}",
  "{totp_code}",
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
                  "rounded-2xl border-2 p-4 text-left transition-[background-color,border-color,box-shadow] duration-300",
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
                type="button"
                key={channel.value}
                onClick={() => updateField("channel", channel.value)}
                aria-pressed={active}
                className={[
                  "rounded-2xl border px-4 py-3 text-left transition-[background-color,border-color,box-shadow]",
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

      <div>
        <h4 className="mb-3 flex items-center gap-2 text-[13px] font-bold text-[var(--fg-base)]">
          <Zap className="size-4 text-[var(--accent)]" />
          Kênh thông báo & Tự động hóa
        </h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => updateField("telegram_notifications_enabled", !config.telegram_notifications_enabled)}
            className={[
              "flex items-center justify-between rounded-2xl border p-4 text-left transition-[background-color,border-color,box-shadow]",
              config.telegram_notifications_enabled
                ? "border-[var(--accent)] bg-[var(--accent)]/5 shadow-sm"
                : "border-[var(--border-soft)] bg-white opacity-70",
            ].join(" ")}
          >
            <div>
              <span className="text-[12px] font-bold text-[var(--fg-base)] block">Telegram Notifications</span>
              <span className="text-[11px] text-[var(--fg-muted)]">Gửi cảnh báo và thông báo qua bot Telegram</span>
            </div>
            <div
              className={`flex h-6 w-10 items-center rounded-full p-0.5 transition-colors duration-300 ${
                config.telegram_notifications_enabled ? "bg-[var(--accent)]" : "bg-gray-300"
              }`}
            >
              <div
                className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-300 ease-out ${
                  config.telegram_notifications_enabled ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </div>
          </button>

          <button
            type="button"
            onClick={() => updateField("webhook_notifications_enabled", !config.webhook_notifications_enabled)}
            className={[
              "flex items-center justify-between rounded-2xl border p-4 text-left transition-[background-color,border-color,box-shadow]",
              config.webhook_notifications_enabled
                ? "border-[var(--accent)] bg-[var(--accent)]/5 shadow-sm"
                : "border-[var(--border-soft)] bg-white opacity-70",
            ].join(" ")}
          >
            <div>
              <span className="text-[12px] font-bold text-[var(--fg-base)] block">Webhook Notifications</span>
              <span className="text-[11px] text-[var(--fg-muted)]">Trigger webhook sự kiện đơn hàng/khách hàng</span>
            </div>
            <div
              className={`flex h-6 w-10 items-center rounded-full p-0.5 transition-colors duration-300 ${
                config.webhook_notifications_enabled ? "bg-[var(--accent)]" : "bg-gray-300"
              }`}
            >
              <div
                className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-300 ease-out ${
                  config.webhook_notifications_enabled ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </div>
          </button>
        </div>
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
          description=""
          value={config.template_renewal_internal}
          onChange={(value) => updateField("template_renewal_internal", value)}
        />

        <TemplateField
          label="Template tương thích cũ"
          description=""
          value={config.template_renewal}
          onChange={(value) => updateField("template_renewal", value)}
        />

        <TemplateField
          label="Template công nợ"
          description=""
          value={config.template_debt}
          onChange={(value) => updateField("template_debt", value)}
        />

        <TemplateField
          label="Template chia sẻ liên kết (Share Link)"
          description=""
          value={config.template_share_link || ""}
          onChange={(value) => updateField("template_share_link", value)}
        />

        <TemplateField
          label="Template thông tin tài khoản (Share Account)"
          description=""
          value={config.template_share_account || ""}
          onChange={(value) => updateField("template_share_account", value)}
        />
      </div>

      <div className="flex items-center justify-between border-t border-[var(--border-soft)] pt-2">
        <button
          type="button"
          onClick={handleTestSend}
          disabled={testSending}
          className="flex items-center gap-2 rounded-xl border border-[var(--border-soft)] px-4 py-2.5 text-[12px] font-bold text-[var(--fg-muted)] transition-[border-color,color,opacity] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
        >
          <Send className="size-3.5" />
          {testSending ? "Đang render..." : "Render test"}
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-[var(--accent)] px-6 py-2.5 text-[13px] font-bold text-white shadow-md shadow-[var(--accent)]/20 transition-opacity hover:opacity-90 disabled:opacity-50"
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
      {description && <p className="mb-2 text-[11px] text-[var(--fg-muted)]">{description}</p>}
      <textarea
        rows={4}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full resize-none rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 font-mono text-[13px] text-emerald-400 placeholder:text-slate-650 outline-none transition-[border-color,box-shadow] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15"
      />
    </div>
  );
}
