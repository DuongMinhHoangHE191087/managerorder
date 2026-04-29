"use client";

import dynamic from "next/dynamic";

import { AppLayout } from "@/widgets/layout/app-layout";
import { PageContainer, PageHeader } from "@/shared/ui/page-layout";
import { CreateFlowShell, CreateFormSection } from "@/shared/ui/create-flow-shell";

const CreateOrderForm = dynamic(
  () =>
    import("@/widgets/pages/orders/components/create-order-form").then((mod) => ({
      default: mod.CreateOrderForm,
    })),
  {
    ssr: false,
    loading: () => <CreateOrderFormSkeleton />,
  },
);

function CreateOrderFormSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        {[0, 1, 2].map((section) => (
          <CreateFormSection
            key={section}
            title={`Đang tải section ${section + 1}`}
            description="Chuẩn bị dữ liệu khách hàng, sản phẩm và thanh toán..."
          >
            <div className="space-y-3">
              <div className="h-11 animate-pulse rounded-2xl bg-[var(--border-soft)]" />
              <div className="h-11 animate-pulse rounded-2xl bg-[var(--border-soft)]" />
              <div className="h-24 animate-pulse rounded-3xl bg-[var(--border-soft)]" />
            </div>
          </CreateFormSection>
        ))}
      </div>
      <div className="rounded-3xl border border-[var(--border-soft)] bg-[var(--surface-light)]/45 p-5">
        <div className="space-y-4">
          <div className="h-6 w-32 animate-pulse rounded bg-[var(--border-soft)]" />
          <div className="h-40 animate-pulse rounded-2xl bg-[var(--border-soft)]" />
          <div className="h-12 animate-pulse rounded-xl bg-[var(--border-soft)]" />
        </div>
      </div>
    </div>
  );
}

export default function NewOrderPage() {
  return (
    <AppLayout>
      <PageContainer variant="narrow">
        <PageHeader
          eyebrow={<span>Sales flow / Orders</span>}
          title="Tạo đơn hàng mới"
          description="Gán khách hàng, sản phẩm và kho hàng để tạo đơn chính xác, dễ theo dõi và đúng nghiệp vụ."
        />

        <CreateFlowShell
          title="Canvas tạo đơn"
          description="Toàn bộ order create flow được gom vào một shell thống nhất để giữ nhịp nhập liệu rộng, rõ và ít phải nhảy context."
          className="mt-6"
          contentClassName="p-0"
        >
          <div className="p-5 sm:p-6">
            <CreateOrderForm />
          </div>
        </CreateFlowShell>
      </PageContainer>
    </AppLayout>
  );
}
