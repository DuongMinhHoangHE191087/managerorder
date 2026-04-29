"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight, Globe } from "lucide-react";
import { DeferredSection } from "@/shared/ui/deferred-section";
import { SectionCard } from "@/shared/ui/section-card";

const PaymentSourceManager = dynamic(
  () => import("@/widgets/pages/settings/components/payment-source-manager").then((module) => ({ default: module.PaymentSourceManager })),
  { ssr: false, loading: () => <SettingsPanelSkeleton rows={4} /> },
);

const SalesChannelManager = dynamic(
  () => import("@/widgets/pages/settings/components/sales-channel-manager").then((module) => ({ default: module.SalesChannelManager })),
  { ssr: false, loading: () => <SettingsPanelSkeleton rows={4} /> },
);
const SalesLandingManager = dynamic(
  () => import("@/widgets/pages/settings/components/sales-landing-manager").then((module) => ({ default: module.SalesLandingManager })),
  { ssr: false, loading: () => <SettingsPanelSkeleton rows={6} /> },
);

const PricingConfigManager = dynamic(
  () => import("@/widgets/pages/settings/components/pricing-config-manager").then((module) => ({ default: module.PricingConfigManager })),
  { ssr: false, loading: () => <SettingsPanelSkeleton rows={3} /> },
);

const ReminderConfigManager = dynamic(
  () => import("@/widgets/pages/settings/components/reminder-config").then((module) => ({ default: module.ReminderConfigManager })),
  { ssr: false, loading: () => <SettingsPanelSkeleton rows={6} /> },
);

const SystemSettingsManager = dynamic(
  () => import("@/widgets/pages/settings/components/system-settings-manager").then((module) => ({ default: module.SystemSettingsManager })),
  { ssr: false, loading: () => <SettingsPanelSkeleton rows={6} /> },
);

function SettingsPanelSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="h-12 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-light)]/70"
        />
      ))}
    </div>
  );
}

function DeferredSettingsCard({
  title,
  description,
  action,
  rows,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  rows: number;
  children: ReactNode;
}) {
  return (
    <DeferredSection
      fallback={
        <SectionCard title={title} description={description} action={action}>
          <SettingsPanelSkeleton rows={rows} />
        </SectionCard>
      }
    >
      <SectionCard title={title} description={description} action={action}>
        {children}
      </SectionCard>
    </DeferredSection>
  );
}

export function SettingsOverviewPanels() {
  return (
    <>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <DeferredSettingsCard
          title="Nguồn thanh toán"
          description="Thêm, sửa và dọn danh mục MoMo, ngân hàng, tiền mặt để mọi luồng thanh toán dùng chung."
          rows={4}
        >
          <PaymentSourceManager />
        </DeferredSettingsCard>

        <DeferredSettingsCard
          title="Kênh bán hàng"
          description="Nguồn phát sinh đơn như Facebook, Zalo, website hoặc đội CTV."
          rows={4}
        >
          <SalesChannelManager />
        </DeferredSettingsCard>
      </div>

      <DeferredSettingsCard
        title="Landing công khai"
        description="Chọn sản phẩm và cấu hình hiển thị cho landing public, trang lỗi và các link hết hạn."
        rows={6}
      >
        <SalesLandingManager />
      </DeferredSettingsCard>

      <DeferredSettingsCard
        title="Cấu hình giá nhập NCC"
        description="Tùy chỉnh mức giảm giá CTV/VIP khi tạo đơn nhập hàng với nhà cung cấp."
        rows={3}
      >
        <PricingConfigManager />
      </DeferredSettingsCard>

      <DeferredSettingsCard
        title="Cấu hình nhắc hẹn"
        description="Quản lý lịch nhắc, template Telegram nội bộ và template Zalo gửi khách hàng."
        rows={6}
      >
        <ReminderConfigManager />
      </DeferredSettingsCard>

      <DeferredSettingsCard
        title="Cấu hình công ty và hoá đơn"
        description="Khai báo thông tin mặc định khi in hoá đơn, sinh QR và render hướng dẫn thanh toán."
        rows={6}
      >
        <SystemSettingsManager />
      </DeferredSettingsCard>

      <Link href="/settings/webhooks" className="group block">
        <div className="glass-card flex items-center justify-between p-6 transition-all duration-300 hover:border-[var(--accent)]/30">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-blue-500/20">
              <Globe className="size-6 text-violet-500" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-[var(--fg-base)] transition-colors group-hover:text-[var(--accent)]">
                Webhooks
              </h3>
              <p className="text-[12px] font-medium text-[var(--fg-muted)]">
                Nhận thông báo real-time khi có đơn hàng, thanh toán, gia hạn và các sự kiện vận hành khác.
              </p>
            </div>
          </div>
          <ChevronRight className="size-5 text-[var(--fg-muted)] transition-all group-hover:translate-x-1 group-hover:text-[var(--accent)]" />
        </div>
      </Link>
    </>
  );
}
