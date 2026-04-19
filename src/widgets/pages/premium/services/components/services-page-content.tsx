"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { CheckCircle2, Globe, Package, Pencil, Plus, Trash2, XCircle } from "lucide-react";

import { AppLayout } from "@/widgets/layout/app-layout";
import { ActionMenu } from "@/shared/ui/action-menu";
import { Button } from "@/shared/ui/button";
import { Modal } from "@/shared/ui/modal";
import { PageContainer, PageHeader, SurfaceCard, StatsGrid, EmptyState, SectionHeader } from "@/shared/ui/page-layout";
import { appToast } from "@/shared/ui/app-toast";
import { readApiEnvelope } from "@/shared/lib/api-client";
import type { PremiumServiceType } from "@/lib/domain/premium-types";

type PremiumServiceRow = PremiumServiceType & {
  package_count?: number;
};

const ServiceCreateModal = dynamic(
  () => import("@/widgets/pages/premium/services/components/service-create-modal").then((module) => ({ default: module.ServiceCreateModal })),
  { ssr: false },
);

const ServiceEditModal = dynamic(
  () => import("@/widgets/pages/premium/services/components/service-edit-modal").then((module) => ({ default: module.ServiceEditModal })),
  { ssr: false },
);

function StatusPill({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={
        isActive
          ? "inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/80 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700"
          : "inline-flex items-center gap-1.5 rounded-full border border-[var(--border-soft)] bg-[rgba(246,250,244,0.9)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--fg-muted)]"
      }
    >
      {isActive ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
      {isActive ? "Hoat dong" : "Tam ngung"}
    </span>
  );
}

export default function PremiumServicesPage() {
  const [services, setServices] = useState<PremiumServiceRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingService, setEditingService] = useState<PremiumServiceRow | null>(null);
  const [deletingService, setDeletingService] = useState<PremiumServiceRow | null>(null);

  useEffect(() => {
    void fetchServices();
  }, []);

  async function fetchServices() {
    try {
      const response = await fetch("/api/premium/services");
      const payload = await readApiEnvelope<PremiumServiceRow[]>(response);

      if (!response.ok) {
        appToast.error(`Khong the tai danh sach dich vu: ${payload.error ?? "Loi khong xac dinh"}`);
        return;
      }

      setServices(payload.data ?? []);
    } catch (error) {
      console.error("[fetchServices]", error);
      appToast.error("Loi ket noi");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete() {
    if (!deletingService) return;

    try {
      const response = await fetch(`/api/premium/services/${deletingService.id}`, { method: "DELETE" });
      const payload = await readApiEnvelope<{ id: string }>(response);

      if (!response.ok) {
        appToast.error(payload.error ?? "Loi xoa dich vu");
        return;
      }

      setServices((current) => current.filter((service) => service.id !== deletingService.id));
      setDeletingService(null);
      appToast.success("Da xoa dich vu");
    } catch (error) {
      console.error("[handleDelete service]", error);
      appToast.error("Loi mang khi xoa");
    }
  }

  const activeCount = services.filter((service) => service.is_active).length;

  return (
    <AppLayout>
      <PageContainer className="relative">
        <PageHeader
          eyebrow={<span>Premium / Services</span>}
          title="Dich vu Premium"
          description="Quan ly danh muc nen tang so va nhom goi kinh doanh tren he thong."
          actions={
            <Button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="rounded-[1rem] bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] px-5 py-2.5 text-sm font-bold text-white shadow-[0_16px_30px_rgba(var(--accent-rgb),0.2)] transition-all hover:shadow-[0_20px_36px_rgba(var(--accent-rgb),0.28)]"
            >
              <Plus className="size-5" />
              Them dich vu
            </Button>
          }
        />

        <StatsGrid className="mt-6">
          <div className="app-card flex h-full flex-col gap-2 p-6">
            <div className="flex items-start justify-between">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Tong dich vu</p>
              <span className="rounded-lg bg-[var(--accent)]/10 p-1.5 text-[var(--accent)]">
                <Globe className="size-5" />
              </span>
            </div>
            <p className="text-3xl font-black text-[var(--fg-base)]">{services.length}</p>
          </div>

          <div className="app-card flex h-full flex-col gap-2 p-6">
            <div className="flex items-start justify-between">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Dang kinh doanh</p>
              <span className="rounded-lg bg-emerald-500/10 p-1.5 text-emerald-600">
                <CheckCircle2 className="size-5" />
              </span>
            </div>
            <p className="text-3xl font-black text-[var(--fg-base)]">{activeCount}</p>
          </div>
        </StatsGrid>

        <SurfaceCard className="mt-6">
          <SectionHeader
            title="Danh sach nen tang"
            description="Tat ca dich vu dang co trong danh muc, trang thai hoat dong va so goi dang mo ban."
          />

          {isLoading ? (
            <div className="space-y-3 p-5 sm:p-6">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="animate-pulse rounded-[1.2rem] border border-[var(--border-soft)] bg-white/60 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-2">
                      <div className="h-4 w-44 rounded bg-[var(--border-soft)]" />
                      <div className="h-3 w-24 rounded bg-[var(--border-soft)]" />
                    </div>
                    <div className="h-8 w-24 rounded-full bg-[var(--border-soft)]" />
                  </div>
                </div>
              ))}
            </div>
          ) : services.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<Globe className="size-6" />}
                title="Chua co dich vu nao"
                description="Them mot dich vu dau tien de khoi tao danh muc Premium."
                action={
                  <Button type="button" variant="primary" onClick={() => setIsCreateOpen(true)}>
                    <Plus className="size-4" />
                    Them dich vu dau tien
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-left text-sm">
                <thead className="bg-[rgba(246,250,244,0.8)] text-[var(--fg-muted)]">
                  <tr className="border-b border-[var(--border-soft)]">
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-widest">Ten dich vu</th>
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-widest">Danh muc</th>
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-widest">Goi cuoc</th>
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-widest">Trang thai</th>
                    <th className="px-5 py-3 text-right text-[11px] font-bold uppercase tracking-widest">Thao tac</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-soft)] bg-white">
                  {services.map((service) => (
                    <tr key={service.id} className="transition-colors hover:bg-[var(--surface-light)]/50">
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="text-[14px] font-bold text-[var(--fg-base)]">{service.name}</span>
                          <span className="text-[11px] font-mono text-[var(--fg-muted)]">/{service.slug}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex rounded-full bg-[var(--surface-light)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                          {service.category}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[var(--fg-base)]">
                          <Package className="size-3.5 text-[var(--accent)]" />
                          {service.package_count ?? 0} goi
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <StatusPill isActive={service.is_active} />
                      </td>
                      <td className="px-5 py-4 text-right">
                        <ActionMenu
                          items={[
                            {
                              label: "Chinh sua",
                              icon: <Pencil className="size-4" />,
                              onClick: () => setEditingService(service),
                            },
                            {
                              label: "Xoa dich vu",
                              icon: <Trash2 className="size-4" />,
                              onClick: () => setDeletingService(service),
                              variant: "danger",
                              dividerBefore: true,
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SurfaceCard>
      </PageContainer>

      <ServiceCreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => {
          void fetchServices();
        }}
      />

      {editingService && (
        <ServiceEditModal
          isOpen={!!editingService}
          onClose={() => setEditingService(null)}
          service={editingService}
          onSuccess={() => {
            void fetchServices();
          }}
        />
      )}

      <Modal
        isOpen={!!deletingService}
        onClose={() => setDeletingService(null)}
        title="Xac nhan xoa"
        size="sm"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeletingService(null)}>
              Huy
            </Button>
            <Button
              variant="primary"
              onClick={handleDelete}
              className="!bg-[var(--danger)] hover:!bg-[var(--danger)] !shadow-none"
            >
              Xoa vinh vien
            </Button>
          </div>
        }
      >
        <div className="text-center py-4">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-[var(--danger)]/10">
            <Trash2 className="size-8 text-[var(--danger)]" />
          </div>
          <p className="mb-2 text-[15px] font-bold text-[var(--fg-base)]">Ban chac chan muon xoa?</p>
          <p className="text-[13px] text-[var(--fg-muted)]">
            Dich vu <span className="font-bold text-[var(--fg-base)]">{deletingService?.name}</span> se bi xoa vinh vien.
          </p>
        </div>
      </Modal>
    </AppLayout>
  );
}
