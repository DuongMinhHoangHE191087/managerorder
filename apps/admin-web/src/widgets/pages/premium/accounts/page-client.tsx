"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { AppLayout } from "@/widgets/layout/app-layout";
import { FiltersBar, PageContainer } from "@/shared/ui/page-layout";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { appToast } from "@/shared/lib/toast";
import { readApiEnvelope } from "@/shared/lib/api-client";
import { AccountsModals } from "./components/accounts-modals";
import { AccountsPageHeader } from "./components/accounts-page-header";
import { AccountsSummaryCards } from "./components/accounts-summary-cards";
import { AccountsTable } from "./components/accounts-table";
import type { PremiumAccountPackage, PremiumAccountRow, PremiumAccountService } from "./types";

type PremiumSubscriptionSummaryRow = {
  status: string;
  days_remaining: number;
};

type PremiumMigrationSummaryRow = {
  status: string;
};

type PremiumSummaryMeta = {
  overallSummary?: {
    activeCount?: number;
    expiringCount?: number;
  };
};

type PremiumMigrationMeta = {
  total?: number;
};

export default function PremiumAccountsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<PremiumAccountRow[]>([]);
  const [services, setServices] = useState<PremiumAccountService[]>([]);
  const [packages, setPackages] = useState<PremiumAccountPackage[]>([]);
  const [activeSubscriptions, setActiveSubscriptions] = useState(0);
  const [expiringSubscriptions, setExpiringSubscriptions] = useState(0);
  const [pendingMigrations, setPendingMigrations] = useState(0);
  const [accountSearch, setAccountSearch] = useState("");
  const [accountStatus, setAccountStatus] = useState("all");
  const [accountServiceId, setAccountServiceId] = useState("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [deletingAccount, setDeletingAccount] = useState<PremiumAccountRow | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    void fetchAccounts();
    void fetchServices();
    void fetchRuntimeSummary();
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

  async function fetchRuntimeSummary() {
    try {
      const [subscriptionsRes, migrationsRes] = await Promise.all([
        fetch("/api/premium/subscriptions?renewal_state=all&page_size=1"),
        fetch("/api/premium/migrations?status=pending&limit=1"),
      ]);

      const [subscriptionsPayload, migrationsPayload] = await Promise.all([
        readApiEnvelope<PremiumSubscriptionSummaryRow[]>(subscriptionsRes),
        readApiEnvelope<PremiumMigrationSummaryRow[]>(migrationsRes),
      ]);

      if (subscriptionsRes.ok) {
        const summary = (subscriptionsPayload.meta as PremiumSummaryMeta | undefined)?.overallSummary;
        const subscriptions = subscriptionsPayload.data ?? [];
        setActiveSubscriptions(
          summary?.activeCount ?? subscriptions.filter((item) => item.status === "active").length,
        );
        setExpiringSubscriptions(
          summary?.expiringCount ??
            subscriptions.filter(
              (item) => item.status === "active" && item.days_remaining > 0 && item.days_remaining <= 7,
            ).length,
        );
      }

      if (migrationsRes.ok) {
        const pendingTotal = Number((migrationsPayload.meta as PremiumMigrationMeta | undefined)?.total ?? 0);
        setPendingMigrations(pendingTotal || (migrationsPayload.data ?? []).length);
      }
    } catch (error) {
      console.error("[fetchRuntimeSummary]", error);
    }
  }

  async function fetchPackages(serviceId: string) {
    try {
      setPackages([]);
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
  const workingConnections = accounts.filter((item) => item.connection_status === "working").length;
  const manualCheckNeeded = accounts.filter((item) => item.connection_status === "manual_check_needed").length;
  const connectionErrors = accounts.filter((item) => item.connection_status === "error").length;
  const visibleAccounts = useMemo(() => {
    const normalizedSearch = accountSearch.trim().toLowerCase();

    return accounts.filter((account) => {
      if (accountStatus !== "all" && account.status !== accountStatus && account.connection_status !== accountStatus) {
        return false;
      }
      if (accountServiceId !== "all" && account.service_type_id !== accountServiceId) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }

      return [
        account.id,
        account.primary_email,
        account.service?.name,
        account.package?.name,
        account.status,
        account.connection_status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [accountSearch, accountServiceId, accountStatus, accounts]);

  return (
    <AppLayout>
      <PageContainer className="relative">
        <AccountsPageHeader
          onCreate={() => setIsCreateOpen(true)}
          onOpenMigrations={() => router.push("/premium/migrations")}
        />
        <AccountsSummaryCards
          totalAccounts={accounts.length}
          totalSlots={totalSlots}
          totalUsed={totalUsed}
          activeSubscriptions={activeSubscriptions}
          expiringSubscriptions={expiringSubscriptions}
          pendingMigrations={pendingMigrations}
          workingConnections={workingConnections}
          manualCheckNeeded={manualCheckNeeded}
          connectionErrors={connectionErrors}
        />
        <FiltersBar className="mt-6 flex-col gap-3">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--fg-muted)]" />
              <Input
                value={accountSearch}
                onChange={(event) => setAccountSearch(event.target.value)}
                placeholder="Tìm email, dịch vụ, gói, trạng thái..."
                className="pl-10"
              />
            </div>
            <Select value={accountServiceId} onChange={(event) => setAccountServiceId(event.target.value)}>
              <option value="all">Tất cả dịch vụ</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </Select>
            <Select value={accountStatus} onChange={(event) => setAccountStatus(event.target.value)}>
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="expired">Đã hết hạn</option>
              <option value="suspended">Tạm ngưng</option>
              <option value="manual_check_needed">Cần kiểm tra</option>
              <option value="error">Lỗi kết nối</option>
            </Select>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setAccountSearch("");
                setAccountStatus("all");
                setAccountServiceId("all");
              }}
              className="rounded-full"
            >
              Reset
            </Button>
          </div>
          <p className="text-[12px] text-[var(--fg-muted)]">
            Hiển thị {visibleAccounts.length} / {accounts.length} tài khoản sau lọc.
          </p>
        </FiltersBar>
        <AccountsTable
          accounts={visibleAccounts}
          isLoading={isLoading}
          onOpenDetail={(account) => router.push(`/premium/accounts/${account.id}`)}
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
