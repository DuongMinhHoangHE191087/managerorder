"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, Package, RefreshCw, X } from "lucide-react";
import { AppLayout } from "@/widgets/layout/app-layout";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { PageContainer, PageHeader, SectionHeader, SurfaceCard, EmptyState } from "@/shared/ui/page-layout";
import { appToast } from "@/shared/lib/toast";
import { readApiEnvelope } from "@/shared/lib/api-client";
import { HealthChecksSummaryCards } from "./components/health-checks-summary-cards";
import { HealthCheckLogDrawer } from "./components/health-check-log-drawer";
import { HealthChecksTable } from "./components/health-checks-table";
import type {
  HealthCheckLogRow,
  HealthCheckPagination,
  HealthCheckRunResponse,
  PremiumAccountOption,
  PremiumServiceOption,
} from "./types";
import {
  formatConnectionStatus,
  formatHealthCheckType,
  formatPremiumAccountStatus,
  type HealthCheckStatusFilter,
  type HealthCheckTypeFilter,
} from "./utils";

const DEFAULT_PAGE_SIZE = 20;

export default function PremiumHealthChecksPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<HealthCheckLogRow[]>([]);
  const [accounts, setAccounts] = useState<PremiumAccountOption[]>([]);
  const [services, setServices] = useState<PremiumServiceOption[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [summaryCounts, setSummaryCounts] = useState({
    workingCount: 0,
    errorCount: 0,
    unknownCount: 0,
    manualCount: 0,
  });
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [selectedStatus, setSelectedStatus] = useState<HealthCheckStatusFilter>("all");
  const [selectedCheckType, setSelectedCheckType] = useState<HealthCheckTypeFilter>("all");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [runningAccountId, setRunningAccountId] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [selectedLog, setSelectedLog] = useState<HealthCheckLogRow | null>(null);

  useEffect(() => {
    void bootstrapLookups();
  }, []);

  const serviceMap = useMemo(
    () =>
      services.reduce<Record<string, PremiumServiceOption>>((accumulator, service) => {
        accumulator[service.id] = service;
        return accumulator;
      }, {}),
    [services],
  );

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId],
  );

  const selectedService = useMemo(
    () => services.find((service) => service.id === selectedServiceId) ?? null,
    [services, selectedServiceId],
  );

  const activeLog = useMemo(
    () => {
      if (!selectedLog) {
        return null;
      }

      return logs.find((log) => log.id === selectedLog.id) ?? selectedLog;
    },
    [logs, selectedLog],
  );

  const pageCount = Math.max(1, Math.ceil(totalElements / pageSize));
  const runButtonLabel = selectedAccount
    ? `Chạy ${selectedAccount.primary_email}`
    : "Chạy toàn bộ";

  async function bootstrapLookups() {
    try {
      const [accountsResponse, servicesResponse] = await Promise.all([
        fetch("/api/premium/accounts"),
        fetch("/api/premium/services"),
      ]);

      const [accountsPayload, servicesPayload] = await Promise.all([
        readApiEnvelope<PremiumAccountOption[]>(accountsResponse),
        readApiEnvelope<PremiumServiceOption[]>(servicesResponse),
      ]);

      if (accountsResponse.ok) {
        setAccounts(accountsPayload.data ?? []);
      }

      if (servicesResponse.ok) {
        setServices(servicesPayload.data ?? []);
      }
    } catch (error) {
      console.error("[bootstrapPremiumHealthChecksLookups]", error);
    } finally {
      setIsBootstrapping(false);
    }
  }

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);

    try {
      const params = new URLSearchParams({
        page: String(pageIndex + 1),
        limit: String(pageSize),
      });

      if (selectedStatus !== "all") {
        params.set("current_status", selectedStatus);
      }

      if (selectedCheckType !== "all") {
        params.set("check_type", selectedCheckType);
      }

      if (selectedAccountId) {
        params.set("premium_account_id", selectedAccountId);
      }

      if (selectedServiceId) {
        params.set("service_type_id", selectedServiceId);
      }

      if (fromDate) {
        params.set("from_date", fromDate);
      }

      if (toDate) {
        params.set("to_date", toDate);
      }

      const response = await fetch(`/api/premium/health-checks?${params.toString()}`);
      const payload = await readApiEnvelope<HealthCheckLogRow[]>(response);
      const pagination = (payload as { pagination?: HealthCheckPagination }).pagination;

      if (!response.ok) {
        appToast.error(payload.error ?? "Không thể tải log health check");
        return;
      }

      setLogs(payload.data ?? []);
      setTotalElements(pagination?.total ?? 0);
      setSummaryCounts(
        pagination?.summary ?? {
          workingCount: 0,
          errorCount: 0,
          unknownCount: 0,
          manualCount: 0,
        },
      );
    } catch (error) {
      console.error("[fetchPremiumHealthChecks]", error);
      appToast.error("Lỗi kết nối khi tải log health check");
    } finally {
      setIsLoading(false);
    }
  }, [
    fromDate,
    pageIndex,
    pageSize,
    selectedAccountId,
    selectedCheckType,
    selectedServiceId,
    selectedStatus,
    toDate,
  ]);

  useEffect(() => {
    void fetchLogs();
    // Keep the log list server-side filtered so the page can scale without loading everything.
  }, [fetchLogs, refreshTick]);

  function resetPagination() {
    setPageIndex(0);
  }

  function refreshLogs() {
    setRefreshTick((current) => current + 1);
  }

  function closeLogDrawer() {
    setSelectedLog(null);
  }

  function clearFilters() {
    setSelectedStatus("all");
    setSelectedCheckType("all");
    setSelectedAccountId("");
    setSelectedServiceId("");
    setFromDate("");
    setToDate("");
    setPageIndex(0);
    refreshLogs();
  }

  async function runHealthCheck(targetAccountId?: string) {
    if (isRunning) {
      return;
    }

    const premiumAccountId = targetAccountId ?? selectedAccountId ?? undefined;
    const noteTarget = premiumAccountId
      ? accounts.find((account) => account.id === premiumAccountId)?.primary_email ?? premiumAccountId
      : "toàn bộ tài khoản đủ điều kiện";

    setIsRunning(true);
    setRunningAccountId(premiumAccountId ?? null);

    try {
      const response = await fetch("/api/premium/health-checks/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          premium_account_id: premiumAccountId,
          notes: `Chạy từ trang Health Checks cho ${noteTarget}`,
        }),
      });
      const payload = await readApiEnvelope<HealthCheckRunResponse>(response);

      if (!response.ok) {
        appToast.error(payload.error ?? "Không thể chạy health check");
        return;
      }

      const checked = payload.data?.checked ?? 0;
      const failed = payload.data?.failed ?? 0;
      appToast.success(
        failed > 0
          ? `Đã chạy ${checked} tài khoản, ${failed} lỗi`
          : `Đã chạy ${checked} tài khoản`,
      );

      setPageIndex(0);
      refreshLogs();
    } catch (error) {
      console.error("[runPremiumHealthChecks]", error);
      appToast.error("Lỗi mạng khi chạy health check");
    } finally {
      setIsRunning(false);
      setRunningAccountId(null);
    }
  }

  return (
    <AppLayout>
      <PageContainer className="relative">
        <PageHeader
          eyebrow={<span>Premium / Health Checks</span>}
          title="Kiểm tra sức khỏe hệ thống"
          actions={
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push("/premium/accounts")}
                className="rounded-[1rem] px-5 py-2.5 text-sm font-bold"
              >
                <Package className="size-4" />
                Kho tài khoản
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={refreshLogs}
                className="rounded-[1rem] px-5 py-2.5 text-sm font-bold"
              >
                <RefreshCw className="size-4" />
                Làm mới
              </Button>
              <Button
                type="button"
                onClick={() => void runHealthCheck()}
                isLoading={isRunning}
                disabled={isRunning || isBootstrapping}
                className="rounded-[1rem] bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] px-5 py-2.5 text-sm font-bold text-white shadow-[0_16px_30px_rgba(var(--accent-rgb),0.2)] transition-[background-color,border-color,box-shadow,color,opacity,transform,width] hover:shadow-[0_20px_36px_rgba(var(--accent-rgb),0.28)]"
              >
                <Activity className="size-4" />
                {runButtonLabel}
              </Button>
            </>
          }
        />

        <HealthChecksSummaryCards
          totalResults={totalElements}
          workingCount={summaryCounts.workingCount}
          errorCount={summaryCounts.errorCount}
          unknownCount={summaryCounts.unknownCount}
          manualCount={summaryCounts.manualCount}
        />

        <SurfaceCard className="mt-6">
          <SectionHeader
            title="Bộ lọc"
            description=""
            action={
              <Button
                type="button"
                variant="ghost"
                onClick={clearFilters}
                className="rounded-full px-4 py-2 text-[13px] font-bold"
              >
                <X className="size-4" />
                Xoá bộ lọc
              </Button>
            }
          />

          <div className="grid gap-4 px-5 py-5 md:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">
                Trạng thái
              </label>
              <Select
                value={selectedStatus}
                onChange={(event) => {
                  setSelectedStatus(event.target.value as HealthCheckStatusFilter);
                  resetPagination();
                }}
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="working">Working</option>
                <option value="error">Lỗi</option>
                <option value="unknown">Chưa rõ</option>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">
                Kiểu kiểm tra
              </label>
              <Select
                value={selectedCheckType}
                onChange={(event) => {
                  setSelectedCheckType(event.target.value as HealthCheckTypeFilter);
                  resetPagination();
                }}
              >
                <option value="all">Tất cả kiểu</option>
                <option value="manual">{formatHealthCheckType("manual")}</option>
                <option value="api">{formatHealthCheckType("api")}</option>
                <option value="scheduled">{formatHealthCheckType("scheduled")}</option>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">
                Tài khoản
              </label>
              <Select
                value={selectedAccountId}
                disabled={isBootstrapping}
                onChange={(event) => {
                  setSelectedAccountId(event.target.value);
                  resetPagination();
                }}
              >
                <option value="">Tất cả tài khoản</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.primary_email} · {formatPremiumAccountStatus(account.status)} ·{" "}
                    {formatConnectionStatus(account.connection_status)}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">
                Dịch vụ
              </label>
              <Select
                value={selectedServiceId}
                disabled={isBootstrapping}
                onChange={(event) => {
                  setSelectedServiceId(event.target.value);
                  resetPagination();
                }}
              >
                <option value="">Tất cả dịch vụ</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} · {service.category}
                    {service.is_active ? "" : " · Đã tắt"}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">
                Từ ngày
              </label>
              <Input
                type="date"
                value={fromDate}
                onChange={(event) => {
                  setFromDate(event.target.value);
                  resetPagination();
                }}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">
                Đến ngày
              </label>
              <Input
                type="date"
                value={toDate}
                onChange={(event) => {
                  setToDate(event.target.value);
                  resetPagination();
                }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-soft)] px-5 py-4">
            <div className="text-[13px] text-[var(--fg-muted)]">
              <span className="font-bold text-[var(--fg-base)]">{totalElements}</span> log khớp bộ lọc · Trang{" "}
              <span className="font-bold text-[var(--fg-base)]">
                {totalElements > 0 ? pageIndex + 1 : 0}
              </span>
              /<span className="font-bold text-[var(--fg-base)]">{pageCount}</span>
            </div>
            <div className="text-[13px] text-[var(--fg-muted)]">
              {selectedAccount ? (
                <>
                  Sẽ chạy cho{" "}
                  <span className="font-bold text-[var(--fg-base)]">{selectedAccount.primary_email}</span>
                </>
              ) : selectedService ? (
                <>
                  Đang lọc dịch vụ{" "}
                  <span className="font-bold text-[var(--fg-base)]">{selectedService.name}</span>
                </>
              ) : (
                <>Sẽ chạy toàn bộ tài khoản đủ điều kiện</>
              )}
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard className="mt-6">
          <SectionHeader
            title="Log kiểm tra"
            description=""
          />

          {isLoading && logs.length === 0 ? (
            <div className="flex items-center justify-center p-12">
              <div className="size-9 animate-spin rounded-full border-4 border-[var(--border-soft)] border-t-[var(--accent)]" />
            </div>
          ) : logs.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<Activity className="size-6" />}
                title="Chưa có log health check"
                description=""
              />
            </div>
          ) : (
            <div className="p-4 sm:p-6">
              <HealthChecksTable
                logs={logs}
                serviceMap={serviceMap}
                isLoading={isLoading}
                pageIndex={pageIndex}
                pageSize={pageSize}
                pageCount={pageCount}
                totalElements={totalElements}
                runningAccountId={runningAccountId}
                onPaginationChange={(nextPageIndex, nextPageSize) => {
                  setPageIndex(nextPageIndex);
                  setPageSize(nextPageSize);
                }}
                onRunAccount={(accountId) => void runHealthCheck(accountId)}
                onOpenLogDetail={(log) => setSelectedLog(log)}
              />
            </div>
          )}
        </SurfaceCard>

        <HealthCheckLogDrawer
          isOpen={!!activeLog}
          log={activeLog}
          service={activeLog ? serviceMap[activeLog.service_type_id] ?? null : null}
          onClose={closeLogDrawer}
          onRunAgain={(accountId) => void runHealthCheck(accountId)}
        />
      </PageContainer>
    </AppLayout>
  );
}
