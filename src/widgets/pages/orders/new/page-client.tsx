"use client";

import dynamic from "next/dynamic";

import { AppLayout } from "@/widgets/layout/app-layout";
import { PageContainer, PageHeader, SurfaceCard } from "@/shared/ui/page-layout";

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
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {[0, 1, 2].map((section) => (
          <div key={section} className="app-card p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="size-8 animate-pulse rounded-full bg-[var(--border-soft)]" />
              <div className="space-y-2">
                <div className="h-5 w-48 animate-pulse rounded bg-[var(--border-soft)]" />
                <div className="h-3 w-64 animate-pulse rounded bg-[var(--border-soft)]" />
              </div>
            </div>
            <div className="space-y-3">
              <div className="h-11 animate-pulse rounded-xl bg-[var(--border-soft)]" />
              <div className="h-11 animate-pulse rounded-xl bg-[var(--border-soft)]" />
              <div className="h-24 animate-pulse rounded-2xl bg-[var(--border-soft)]" />
            </div>
          </div>
        ))}
      </div>
      <div className="app-card p-6">
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

        <SurfaceCard className="mt-6">
          <div className="p-5 sm:p-6">
            <CreateOrderForm />
          </div>
        </SurfaceCard>
      </PageContainer>
    </AppLayout>
  );
}
