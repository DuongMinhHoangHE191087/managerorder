"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Activity,
  ArrowLeft,
  ArrowRightLeft,
  CalendarClock,
  ClipboardList,
  Copy,
  RefreshCw,
  Save,
  UserCog,
  UserPlus,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/widgets/layout/app-layout";
import { appToast } from "@/shared/lib/toast";
import { readApiEnvelope } from "@/shared/lib/api-client";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import {
  EmptyState,
  FiltersBar,
  PageContainer,
  PageHeader,
  SectionHeader,
  StatsGrid,
  SurfaceCard,
} from "@/shared/ui/page-layout";
import type {
  PremiumAccountDetailUserSummary,
  PremiumAccountDetailViewModel,
  PremiumAccountUpdatePayload,
} from "@/lib/types/premium-admin";

type AccountConfigFormState = {
  primary_email: string;
  total_slots: string;
  subscription_start_date: string;
  subscription_expiry_date: string;
  status: PremiumAccountDetailViewModel["status"];
  connection_status: NonNullable<PremiumAccountDetailViewModel["connection_status"]> | "";
  phone_number: string;
  purchase_invoice_url: string;
  notes: string;
  primary_password: string;
};

type UserDraftMap = Record<
  string,
  {
    user_email: string;
    status: PremiumAccountDetailUserSummary["status"];
  }
>;

const AUDIT_PAGE_LIMIT = 12;

function formatDateLabel(value?: string | null) {
  if (!value) return "Chưa có";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Chưa có";
  return format(parsed, "dd/MM/yyyy");
}

function formatDateTimeLabel(value?: string | null) {
  if (!value) return "Chưa có";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Chưa có";
  return format(parsed, "dd/MM/yyyy HH:mm");
}

function toDateInputValue(value?: string | null) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function getConnectionTone(status: PremiumAccountDetailViewModel["connection_status"]) {
  switch (status) {
    case "working":
      return "bg-emerald-500/10 text-emerald-700";
    case "error":
      return "bg-[var(--danger)]/10 text-[var(--danger)]";
    case "manual_check_needed":
      return "bg-amber-500/10 text-amber-700";
    default:
      return "bg-[var(--surface-light)] text-[var(--fg-muted)]";
  }
}

function buildFormState(detail: PremiumAccountDetailViewModel): AccountConfigFormState {
  return {
    primary_email: detail.primary_email,
    total_slots: String(detail.total_slots),
    subscription_start_date: toDateInputValue(detail.subscription_start_date),
    subscription_expiry_date: toDateInputValue(detail.subscription_expiry_date),
    status: detail.status,
    connection_status: detail.connection_status ?? "",
    phone_number: detail.phone_number ?? "",
    purchase_invoice_url: detail.purchase_invoice_url ?? "",
    notes: detail.notes ?? "",
    primary_password: "",
  };
}

function buildUserDrafts(users: PremiumAccountDetailUserSummary[]): UserDraftMap {
  return Object.fromEntries(
    users.map((user) => [
      user.id,
      {
        user_email: user.user_email,
        status: user.status,
      },
    ]),
  );
}

function MetricCard({
  label,
  value,
  hint,
  accentClass,
}: {
  label: string;
  value: string | number;
  hint: string;
  accentClass?: string;
}) {
  return (
    <div className="app-card flex h-full flex-col gap-2 p-5">
      <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">{label}</p>
      <p className={`text-[28px] font-black ${accentClass ?? "text-[var(--fg-base)]"}`}>{value}</p>
      <p className="text-[12px] text-[var(--fg-muted)]">{hint}</p>
    </div>
  );
}

export default function PremiumAccountDetailPage({ accountId }: { accountId: string }) {
  const router = useRouter();
  const [detail, setDetail] = useState<PremiumAccountDetailViewModel | null>(null);
  const [configForm, setConfigForm] = useState<AccountConfigFormState | null>(null);
  const [userDrafts, setUserDrafts] = useState<UserDraftMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunningHealthCheck, setIsRunningHealthCheck] = useState(false);
  const [creatingUserEmail, setCreatingUserEmail] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [auditPage, setAuditPage] = useState(1);

  async function fetchDetail(nextAuditPage = auditPage, options?: { silent?: boolean }) {
    const silent = options?.silent ?? false;
    if (silent) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const response = await fetch(
        `/api/premium/accounts/${accountId}?audit_page=${nextAuditPage}&audit_limit=${AUDIT_PAGE_LIMIT}`,
      );
      const payload = await readApiEnvelope<PremiumAccountDetailViewModel>(response);

      if (!response.ok || !payload.data) {
        appToast.error(payload.error ?? "Không thể tải chi tiết account");
        return;
      }

      setDetail(payload.data);
      setConfigForm(buildFormState(payload.data));
      setUserDrafts(buildUserDrafts(payload.data.users));
      setAuditPage(nextAuditPage);
    } catch (error) {
      console.error("[fetchPremiumAccountDetail]", error);
      appToast.error("Lỗi mạng khi tải chi tiết account");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    void fetchDetail(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  const isLocalFixture = detail?.isLocalFixture === true;
  const auditHasPrevious = (detail?.audit.meta.page ?? 1) > 1;
  const auditHasNext = detail ? detail.audit.meta.page < detail.audit.meta.totalPages : false;
  const subscriptionHealth = useMemo(() => {
    if (!detail) return { nearExpiry: 0, migrated: 0 };
    return {
      nearExpiry: detail.subscriptions.filter((item) => item.days_remaining > 0 && item.days_remaining <= 7).length,
      migrated: detail.subscriptions.filter((item) => item.migration_id).length,
    };
  }, [detail]);

  async function handleSaveConfig() {
    if (!configForm) return;

    setIsSaving(true);
    const payload: PremiumAccountUpdatePayload = {
      primary_email: configForm.primary_email.trim(),
      total_slots: Number(configForm.total_slots) || 0,
      subscription_start_date: configForm.subscription_start_date || null,
      subscription_expiry_date: configForm.subscription_expiry_date || null,
      status: configForm.status,
      connection_status: configForm.connection_status || null,
      phone_number: configForm.phone_number.trim() || null,
      purchase_invoice_url: configForm.purchase_invoice_url.trim() || null,
      notes: configForm.notes.trim() || null,
      ...(configForm.primary_password.trim() ? { primary_password: configForm.primary_password.trim() } : {}),
    };

    try {
      const response = await fetch(`/api/premium/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const apiPayload = await readApiEnvelope<PremiumAccountDetailViewModel>(response);

      if (!response.ok || !apiPayload.data) {
        appToast.error(apiPayload.error ?? "Không thể cập nhật account");
        return;
      }

      setDetail(apiPayload.data);
      setConfigForm(buildFormState(apiPayload.data));
      appToast.success("Đã cập nhật account premium");
    } catch (error) {
      console.error("[savePremiumAccountConfig]", error);
      appToast.error("Lỗi mạng khi cập nhật account");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRunHealthCheck() {
    setIsRunningHealthCheck(true);
    try {
      const response = await fetch("/api/premium/health-checks/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          premium_account_id: accountId,
          notes: "Chạy từ premium account detail",
        }),
      });
      const payload = await readApiEnvelope<{ checked: number }>(response);
      if (!response.ok) {
        appToast.error(payload.error ?? "Không thể chạy health check");
        return;
      }
      appToast.success(`Đã chạy health check cho ${payload.data?.checked ?? 0} account`);
      await fetchDetail(auditPage, { silent: true });
    } catch (error) {
      console.error("[runPremiumAccountHealthCheck]", error);
      appToast.error("Lỗi mạng khi chạy health check");
    } finally {
      setIsRunningHealthCheck(false);
    }
  }

  async function mutateUser(
    url: string,
    options: RequestInit,
    successMessage: string,
    done?: () => void,
    settled?: () => void,
  ) {
    if (isLocalFixture) {
      appToast.error("Dữ liệu sandbox cục bộ đang ở chế độ chỉ đọc");
      settled?.();
      return;
    }
    try {
      const response = await fetch(url, options);
      const payload = await readApiEnvelope(response);
      if (!response.ok) {
        appToast.error(payload.error ?? "Không thể cập nhật sub-user");
        return;
      }
      done?.();
      appToast.success(successMessage);
      await fetchDetail(auditPage, { silent: true });
    } catch (error) {
      console.error("[mutatePremiumUser]", error);
      appToast.error("Lỗi mạng khi cập nhật sub-user");
    } finally {
      settled?.();
    }
  }

  async function copyValue(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value);
      appToast.success(successMessage);
    } catch (error) {
      console.error("[copyPremiumAccountValue]", error);
      appToast.error("Không thể sao chép vào clipboard");
    }
  }

  if (isLoading || !detail || !configForm) {
    return (
      <AppLayout>
        <PageContainer>
          <div className="flex min-h-[60vh] items-center justify-center">
            <div className="size-10 animate-spin rounded-full border-4 border-[var(--border-soft)] border-t-[var(--accent)]" />
          </div>
        </PageContainer>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageContainer className="relative">
        <PageHeader
          eyebrow={<span>Premium / Accounts / Detail</span>}
          title={detail.primary_email}
          description="Canonical admin surface cho premium account: cấu hình, subscriptions, sub-users, migrations, health checks và audit trail."
          actions={
            <>
              <Button variant="secondary" onClick={() => router.push("/premium/accounts")}>
                <ArrowLeft className="size-4" />
                Về kho accounts
              </Button>
              <Button variant="secondary" onClick={() => void fetchDetail(auditPage, { silent: true })} isLoading={isRefreshing}>
                <RefreshCw className="size-4" />
                Làm mới
              </Button>
              <Button variant="secondary" onClick={() => void handleRunHealthCheck()} isLoading={isRunningHealthCheck}>
                <Activity className="size-4" />
                Chạy health check
              </Button>
              <Button onClick={() => void handleSaveConfig()} isLoading={isSaving}>
                <Save className="size-4" />
                Lưu cấu hình
              </Button>
            </>
          }
        />

        <StatsGrid className="mt-6">
          <MetricCard label="Slot khả dụng" value={detail.metrics.available_slots} hint={`${detail.used_slots}/${detail.total_slots} slot đang dùng`} accentClass="text-[var(--accent)]" />
          <MetricCard label="Thuê bao active" value={detail.metrics.active_subscription_count} hint={`${subscriptionHealth.nearExpiry} thuê bao sắp hết hạn`} accentClass="text-emerald-700" />
          <MetricCard label="Renewal chờ duyệt" value={detail.metrics.pending_renewal_count} hint={`${detail.renewals.length} bản ghi renewal gần nhất`} accentClass="text-amber-700" />
          <MetricCard label="Migration liên quan" value={detail.metrics.pending_migration_count} hint={`${subscriptionHealth.migrated} thuê bao có lịch sử migration`} accentClass="text-sky-700" />
        </StatsGrid>

        <FiltersBar className="mt-6 items-center justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[var(--border-soft)] bg-white px-3 py-1 text-[11px] font-bold text-[var(--fg-base)]">{detail.service?.name ?? "Chưa có dịch vụ"}</span>
            <span className="rounded-full border border-[var(--border-soft)] bg-white px-3 py-1 text-[11px] font-bold text-[var(--fg-base)]">{detail.package?.name ?? "Chưa có gói"}</span>
            <span className={`rounded-full border border-transparent px-3 py-1 text-[11px] font-bold ${getConnectionTone(detail.connection_status)}`}>{detail.connection_status ?? "unknown"}</span>
            {isLocalFixture ? <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[11px] font-bold text-amber-700">Sandbox local fallback</span> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => router.push("/premium/migrations")}><ArrowRightLeft className="size-4" />Mở migrations</Button>
            <Button variant="secondary" onClick={() => router.push("/premium/health-checks")}><ClipboardList className="size-4" />Xem health logs</Button>
          </div>
        </FiltersBar>

        <div className="mt-6 grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
          <div className="min-w-0 space-y-6">
            <SurfaceCard>
              <SectionHeader title="Cấu hình account" description="Cập nhật metadata, dung lượng slot, hạn thuê bao và trạng thái vận hành." action={<Button onClick={() => void handleSaveConfig()} isLoading={isSaving}><Save className="size-4" />Lưu</Button>} />
              <div className="grid min-w-0 grid-cols-1 gap-4 p-4 sm:p-5 md:grid-cols-2">
                <div className="space-y-2"><label className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Email chính</label><Input value={configForm.primary_email} onChange={(event) => setConfigForm((current) => current ? { ...current, primary_email: event.target.value } : current)} /></div>
                <div className="space-y-2"><label className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Mật khẩu mới</label><Input type="password" value={configForm.primary_password} placeholder="Để trống nếu không đổi" onChange={(event) => setConfigForm((current) => current ? { ...current, primary_password: event.target.value } : current)} /></div>
                <div className="space-y-2"><label className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Tổng slot</label><Input type="number" min={detail.used_slots} value={configForm.total_slots} onChange={(event) => setConfigForm((current) => current ? { ...current, total_slots: event.target.value } : current)} /></div>
                <div className="space-y-2"><label className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Số điện thoại</label><Input value={configForm.phone_number} onChange={(event) => setConfigForm((current) => current ? { ...current, phone_number: event.target.value } : current)} /></div>
                <div className="space-y-2"><label className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Ngày bắt đầu</label><Input type="date" value={configForm.subscription_start_date} onChange={(event) => setConfigForm((current) => current ? { ...current, subscription_start_date: event.target.value } : current)} /></div>
                <div className="space-y-2"><label className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Ngày hết hạn</label><Input type="date" value={configForm.subscription_expiry_date} onChange={(event) => setConfigForm((current) => current ? { ...current, subscription_expiry_date: event.target.value } : current)} /></div>
                <div className="space-y-2"><label className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Trạng thái account</label><Select value={configForm.status} onChange={(event) => setConfigForm((current) => current ? { ...current, status: event.target.value as PremiumAccountDetailViewModel["status"] } : current)}><option value="active">Đang hoạt động</option><option value="expired">Đã hết hạn</option><option value="suspended">Tạm ngưng</option><option value="cancelled">Đã hủy</option></Select></div>
                <div className="space-y-2"><label className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Tình trạng kết nối</label><Select value={configForm.connection_status} onChange={(event) => setConfigForm((current) => current ? { ...current, connection_status: event.target.value as AccountConfigFormState["connection_status"] } : current)}><option value="">Chưa gắn</option><option value="working">working</option><option value="manual_check_needed">manual_check_needed</option><option value="error">error</option></Select></div>
                <div className="space-y-2 md:col-span-2"><label className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Hoá đơn mua</label><Input value={configForm.purchase_invoice_url} onChange={(event) => setConfigForm((current) => current ? { ...current, purchase_invoice_url: event.target.value } : current)} /></div>
                <div className="space-y-2 md:col-span-2"><label className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Ghi chú vận hành</label><textarea value={configForm.notes} onChange={(event) => setConfigForm((current) => current ? { ...current, notes: event.target.value } : current)} className="min-h-[120px] w-full rounded-[1rem] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.88)] px-3 py-2 text-[13px] font-medium text-[var(--fg-base)] shadow-sm outline-none transition-[background-color,border-color,box-shadow,color,opacity,transform,width] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]" /></div>
              </div>
            </SurfaceCard>

            <SurfaceCard>
              <SectionHeader title="Linked subscriptions" description="Mở thẳng customer profile hoặc chuyển sang surface migrations khi cần điều chuyển." />
              <div className="space-y-3 p-5">
                {detail.subscriptions.length === 0 ? <EmptyState icon={<ClipboardList className="size-6" />} title="Chưa có thuê bao nào" description="Account này chưa cấp quyền cho khách hàng nào." /> : detail.subscriptions.map((subscription) => (
                  <div key={subscription.id} className="rounded-[1.4rem] border border-[var(--border-soft)] bg-white p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <button type="button" onClick={() => router.push(`/customers/${subscription.customer_id}`)} className="text-left text-[15px] font-black text-[var(--fg-base)] transition-colors hover:text-[var(--accent)]">{subscription.customer_name}</button>
                        <p className="mt-2 text-[12px] text-[var(--fg-muted)]">Bắt đầu {formatDateLabel(subscription.start_date)} • Hết hạn {formatDateLabel(subscription.expiry_date)}</p>
                        <p className="mt-1 text-[12px] text-[var(--fg-muted)]">{subscription.days_remaining > 0 ? `Còn ${subscription.days_remaining} ngày` : "Đã quá hạn"}{subscription.premium_account_user_email ? ` • User ${subscription.premium_account_user_email}` : ""}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" onClick={() => router.push(`/customers/${subscription.customer_id}`)}>Khách hàng</Button>
                        <Button variant="secondary" onClick={() => router.push("/premium/subscriptions")}><ClipboardList className="size-4" />Mở subscriptions</Button>
                        {subscription.migration_id ? <Button variant="secondary" onClick={() => router.push("/premium/migrations")}><ArrowRightLeft className="size-4" />Migration liên quan</Button> : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </SurfaceCard>
          </div>

          <div className="min-w-0 space-y-6">
            <SurfaceCard>
              <SectionHeader title="Sub-users" description="CRUD trực tiếp sub-users và trạng thái slot ngay tại account detail." action={<span className="rounded-full border border-[var(--border-soft)] bg-white px-3 py-1 text-[11px] font-bold text-[var(--fg-base)]">{detail.metrics.active_user_count}/{detail.metrics.user_count} active</span>} />
              <div className="space-y-4 p-5">
                <div className="rounded-[1.4rem] border border-[var(--border-soft)] bg-[var(--surface-light)]/50 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Thêm sub-user mới</p>
                  <p className="mt-1 text-[12px] text-[var(--fg-muted)]">{isLocalFixture ? "Sandbox local đang ở chế độ read-only." : "Tạo thêm slot trực tiếp cho account này."}</p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <Input value={creatingUserEmail} placeholder="user-email@example.com" onChange={(event) => setCreatingUserEmail(event.target.value)} />
                    <Button onClick={() => { setCreatingUser(true); void mutateUser(`/api/premium/accounts/${accountId}/users`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_email: creatingUserEmail.trim() }) }, "Đã thêm sub-user", () => { setCreatingUserEmail(""); }, () => setCreatingUser(false)); }} isLoading={creatingUser} disabled={isLocalFixture}><UserPlus className="size-4" />Thêm user</Button>
                  </div>
                </div>

                {detail.users.length === 0 ? <EmptyState icon={<UserCog className="size-6" />} title="Chưa có sub-user" description="Account này chưa có user chia sẻ nào." /> : detail.users.map((user) => {
                  const draft = userDrafts[user.id] ?? { user_email: user.user_email, status: user.status };
                  return (
                    <div key={user.id} className="rounded-[1.3rem] border border-[var(--border-soft)] bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div><p className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Sub-user</p><p className="mt-1 text-[12px] text-[var(--fg-muted)]">Tạo lúc {formatDateTimeLabel(user.created_at)}</p></div>
                        <span className={`rounded-full border border-transparent px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${user.status === "active" ? "bg-emerald-500/10 text-emerald-700" : user.status === "suspended" ? "bg-amber-500/10 text-amber-700" : "bg-[var(--danger)]/10 text-[var(--danger)]"}`}>{user.status}</span>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                        <Input value={draft.user_email} onChange={(event) => setUserDrafts((current) => ({ ...current, [user.id]: { ...draft, user_email: event.target.value } }))} />
                        <Select value={draft.status} onChange={(event) => setUserDrafts((current) => ({ ...current, [user.id]: { ...draft, status: event.target.value as PremiumAccountDetailUserSummary["status"] } }))}><option value="active">active</option><option value="suspended">suspended</option><option value="removed">removed</option></Select>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button variant="secondary" onClick={() => { setSavingUserId(user.id); void mutateUser(`/api/premium/accounts/${accountId}/users/${user.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) }, "Đã cập nhật sub-user", undefined, () => setSavingUserId(null)); }} isLoading={savingUserId === user.id} disabled={isLocalFixture}><Save className="size-4" />Lưu user</Button>
                        <Button variant="secondary" onClick={() => void copyValue(user.user_email, "Đã sao chép email sub-user")}><Copy className="size-4" />Sao chép</Button>
                        <Button variant="danger" onClick={() => { setRemovingUserId(user.id); void mutateUser(`/api/premium/accounts/${accountId}/users/${user.id}`, { method: "DELETE" }, "Đã gỡ sub-user", undefined, () => setRemovingUserId(null)); }} isLoading={removingUserId === user.id} disabled={isLocalFixture}><XCircle className="size-4" />Gỡ user</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </SurfaceCard>

            <SurfaceCard>
              <SectionHeader title="Recent health checks" description="Các lần kiểm tra kết nối gần nhất của account." />
              <div className="space-y-3 p-5">
                {detail.healthChecks.length === 0 ? <EmptyState icon={<Activity className="size-6" />} title="Chưa có health log" description="Chạy health check để bắt đầu ghi timeline." /> : detail.healthChecks.map((log) => (
                  <div key={log.id} className="rounded-[1.3rem] border border-[var(--border-soft)] bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div><p className="text-[13px] font-bold text-[var(--fg-base)]">{formatDateTimeLabel(log.check_timestamp)}</p><p className="mt-1 text-[12px] text-[var(--fg-muted)]">{log.check_type} • previous: {log.previous_status ?? "n/a"}</p>{log.error_message ? <p className="mt-2 text-[12px] text-[var(--danger)]">{log.error_message}</p> : null}</div>
                      <span className={`rounded-full border border-transparent px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${log.current_status === "working" ? "bg-emerald-500/10 text-emerald-700" : log.current_status === "error" ? "bg-[var(--danger)]/10 text-[var(--danger)]" : "bg-amber-500/10 text-amber-700"}`}>{log.current_status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </SurfaceCard>

            <SurfaceCard>
              <SectionHeader title="Audit trail" description="Lịch sử thay đổi và sự kiện vận hành gắn với premium account này." action={<div className="flex items-center gap-2"><Button variant="secondary" disabled={!auditHasPrevious} onClick={() => void fetchDetail(Math.max(1, auditPage - 1), { silent: true })}>Trang trước</Button><Button variant="secondary" disabled={!auditHasNext} onClick={() => void fetchDetail(auditPage + 1, { silent: true })}>Trang sau</Button></div>} />
              <div className="space-y-3 p-5">
                <div className="rounded-[1.2rem] border border-[var(--border-soft)] bg-[var(--surface-light)]/50 px-4 py-3 text-[12px] text-[var(--fg-muted)]">Trang {detail.audit.meta.page}/{Math.max(detail.audit.meta.totalPages, 1)} • {detail.audit.meta.count} bản ghi</div>
                {detail.audit.items.length === 0 ? <EmptyState icon={<CalendarClock className="size-6" />} title="Chưa có audit record" description="Các thao tác mutate trên account sẽ xuất hiện tại đây." /> : detail.audit.items.map((item) => (
                  <div key={item.id} className="rounded-[1.3rem] border border-[var(--border-soft)] bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div><p className="text-[12px] font-black uppercase tracking-widest text-[var(--fg-muted)]">{item.action_type}</p><p className="mt-1 text-[13px] font-semibold text-[var(--fg-base)]">{formatDateTimeLabel(item.created_at)}</p><p className="mt-1 text-[12px] text-[var(--fg-muted)]">actor: {item.created_by ?? "system"}</p></div>
                      <Button variant="secondary" onClick={() => void copyValue(item.id, "Đã sao chép ID audit")}><Copy className="size-4" />Sao chép</Button>
                    </div>
                    {item.details ? <pre className="custom-scrollbar mt-3 max-h-56 overflow-auto rounded-[1rem] border border-[var(--border-soft)] bg-[var(--surface-light)]/50 p-3 text-[11px] leading-5 text-[var(--fg-base)]">{JSON.stringify(item.details, null, 2)}</pre> : null}
                  </div>
                ))}
              </div>
            </SurfaceCard>
          </div>
        </div>
      </PageContainer>
    </AppLayout>
  );
}
