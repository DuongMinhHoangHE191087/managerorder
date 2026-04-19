"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/widgets/layout/app-layout";
import { PageContainer } from "@/shared/ui/page-layout";
import { appToast } from "@/shared/lib/toast";
import { readApiEnvelope } from "@/shared/lib/api-client";
import { AccountsModals } from "./components/accounts-modals";
import { AccountsPageHeader } from "./components/accounts-page-header";
import { AccountsSummaryCards } from "./components/accounts-summary-cards";
import { AccountsTable } from "./components/accounts-table";
import type { PremiumAccountPackage, PremiumAccountRow, PremiumAccountService } from "./types";

export default function PremiumAccountsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<PremiumAccountRow[]>([]);
  const [services, setServices] = useState<PremiumAccountService[]>([]);
  const [packages, setPackages] = useState<PremiumAccountPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [deletingAccount, setDeletingAccount] = useState<PremiumAccountRow | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    void fetchAccounts();
    void fetchServices();
  }, []);

  useEffect(() => {
    if (selectedServiceId) {
      void fetchPackages(selectedServiceId);
    } else {
      setPackages([]);
    }
  }, [selectedServiceId]);

  function closeCreateModal() {
    setIsCreateOpen(false);
    setSelectedServiceId("");
  }

  async function fetchAccounts() {
    try {
      const response = await fetch("/api/premium/accounts");
      const payload = await readApiEnvelope<PremiumAccountRow[]>(response);
      if (response.ok) {
        setAccounts(payload.data ?? []);
      } else {
        appToast.error(`Không thể tải danh sách tài khoản: ${payload.error ?? "Lỗi không xác định"}`);
      }
    } catch (error) {
      console.error("[fetchAccounts]", error);
      appToast.error("Lỗi kết nối khi tải tài khoản");
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchServices() {
    try {
      const response = await fetch("/api/premium/services");
      const payload = await readApiEnvelope<PremiumAccountService[]>(response);
      if (response.ok) {
        setServices(payload.data?.filter((service) => service.is_active) ?? []);
      }
    } catch (error) {
      console.error("[fetchServices]", error);
    }
  }

  async function fetchPackages(serviceId: string) {
    try {
      const response = await fetch(`/api/premium/packages?service_type_id=${serviceId}`);
      const payload = await readApiEnvelope<PremiumAccountPackage[]>(response);
      if (response.ok) {
        setPackages(payload.data ?? []);
      }
    } catch (error) {
      console.error("[fetchPackages]", error);
    }
  }

  async function handleCreate(formData: FormData) {
    const packageId = formData.get("package_id") as string;
    const selectedPackage = packages.find((item) => item.id === packageId);

    const body = {
      service_type_id: formData.get("service_type_id") as string,
      package_id: packageId,
      primary_email: formData.get("primary_email") as string,
      primary_password_encrypted: formData.get("primary_password") as string,
      total_slots: selectedPackage ? selectedPackage.total_slots : parseInt((formData.get("total_slots") as string) || "5", 10),
      subscription_start_date: formData.get("subscription_start_date") as string,
      subscription_expiry_date: formData.get("subscription_expiry_date") as string,
    };

    try {
      const response = await fetch("/api/premium/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await readApiEnvelope<PremiumAccountRow>(response);

      if (response.ok) {
        const createdAccount = payload.data;
        if (createdAccount) {
          setAccounts((current) => [createdAccount, ...current]);
        }
        closeCreateModal();
        appToast.success("Đã thêm tài khoản gốc vào kho!");
      } else {
        appToast.error(payload.error || "Lỗi tạo tài khoản");
      }
    } catch (error) {
      console.error("[handleCreate]", error);
      appToast.error("Lỗi mạng khi tạo tài khoản");
    }
  }

  async function handleDelete() {
    if (!deletingAccount) return;

    try {
      const response = await fetch(`/api/premium/accounts/${deletingAccount.id}`, { method: "DELETE" });
      const payload = await readApiEnvelope<{ id: string }>(response);

      if (response.ok) {
        setAccounts((current) => current.filter((item) => item.id !== deletingAccount.id));
        setDeletingAccount(null);
        appToast.success("Đã xóa tài khoản khỏi kho");
      } else {
        appToast.error(payload.error || "Lỗi xóa tài khoản");
      }
    } catch (error) {
      console.error("[handleDelete]", error);
      appToast.error("Lỗi mạng khi xóa");
    }
  }

  const totalSlots = accounts.reduce((accumulator, current) => accumulator + current.total_slots, 0);
  const totalUsed = accounts.reduce((accumulator, current) => accumulator + current.used_slots, 0);

  return (
    <AppLayout>
      <PageContainer className="relative">
        <AccountsPageHeader onCreate={() => setIsCreateOpen(true)} />
        <AccountsSummaryCards totalAccounts={accounts.length} totalSlots={totalSlots} totalUsed={totalUsed} />
        <AccountsTable
          accounts={accounts}
          isLoading={isLoading}
          onOpenSubscriptions={() => router.push("/premium/subscriptions")}
          onDelete={setDeletingAccount}
        />
      </PageContainer>

      <AccountsModals
        isCreateOpen={isCreateOpen}
        selectedServiceId={selectedServiceId}
        today={today}
        services={services}
        packages={packages}
        onCloseCreate={closeCreateModal}
        onServiceChange={setSelectedServiceId}
        onSubmitCreate={handleCreate}
        deletingAccount={deletingAccount}
        onCloseDelete={() => setDeletingAccount(null)}
        onDelete={handleDelete}
      />
    </AppLayout>
  );
}
