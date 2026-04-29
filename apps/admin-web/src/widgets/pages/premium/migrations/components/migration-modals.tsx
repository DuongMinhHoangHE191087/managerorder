"use client";

import {
  CheckCircle2,
  ClipboardList,
  Copy,
  Loader2,
  Play,
  Save,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { calculateAvailableSlots } from "@/lib/domain/premium-account-math";
import type { PremiumAccountDetailViewModel } from "@/lib/types/premium-admin";
import { appToast } from "@/shared/lib/toast";
import { readApiEnvelope } from "@/shared/lib/api-client";
import { Button } from "@/shared/ui/button";
import {
  AdvancedOptionsDisclosure,
  CreateActionFooter,
  CreateFlowDialog,
  CreateFormSection,
} from "@/shared/ui/create-flow-shell";
import { Input } from "@/shared/ui/input";
import { Modal } from "@/shared/ui/modal";
import { Select } from "@/shared/ui/select";
import { SmartSelector } from "@/shared/ui/smart-selector";
import type {
  MigrationAccountRow,
  MigrationDetailRow,
  MigrationListRow,
  MigrationSubscriptionRow,
} from "../types";
import {
  formatDateTime,
  getMigrationStatusLabel,
  getStatusClass,
  getStepStatusClass,
  jsonPreview,
  migrationAccountLabel,
  subscriptionLabel,
} from "../utils";

function MigrationRequestModal({
  isOpen,
  onClose,
  subscriptions,
  accounts,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  subscriptions: MigrationSubscriptionRow[];
  accounts: MigrationAccountRow[];
  onCreated: (migration: MigrationListRow) => void;
}) {
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState("");
  const [selectedTargetAccountId, setSelectedTargetAccountId] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedSubscription = useMemo(
    () => subscriptions.find((item) => item.id === selectedSubscriptionId) ?? null,
    [selectedSubscriptionId, subscriptions],
  );

  const eligibleTargetAccounts = useMemo(() => {
    if (!selectedSubscription?.account?.service_type_id) {
      return accounts.filter((account) => account.status === "active" && account.available_slots > 0);
    }

    return accounts.filter((account) => {
      const isCompatible = account.service_type_id === selectedSubscription.account?.service_type_id;
      const hasSlots = account.available_slots > 0;
      const isActive = account.status === "active";
      const notSameSource = account.id !== selectedSubscription.account?.id;

      return isCompatible && hasSlots && isActive && notSameSource;
    });
  }, [accounts, selectedSubscription]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setSelectedSubscriptionId("");
    setSelectedTargetAccountId("");
    setReason("");
    setNotes("");
    setSaving(false);
  }, [isOpen]);

  useEffect(() => {
    if (!selectedTargetAccountId) {
      return;
    }

    const stillValid = eligibleTargetAccounts.some((account) => account.id === selectedTargetAccountId);
    if (!stillValid) {
      setSelectedTargetAccountId("");
    }
  }, [eligibleTargetAccounts, selectedTargetAccountId]);

  const selectedTargetAccount = eligibleTargetAccounts.find((account) => account.id === selectedTargetAccountId) ?? null;

  async function handleSubmit() {
    if (!selectedSubscriptionId || !selectedTargetAccountId || !reason.trim()) {
      appToast.error("Chọn thuê bao, kho đích và nhập lý do trước khi tạo yêu cầu");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/premium/migrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription_id: selectedSubscriptionId,
          target_account_id: selectedTargetAccountId,
          reason: reason.trim(),
          notes: notes.trim() || undefined,
        }),
      });
      const payload = await readApiEnvelope<MigrationListRow>(response);

      if (!response.ok || !payload.data) {
        appToast.error(payload.error ?? "Không thể tạo yêu cầu di chuyển");
        return;
      }

      onCreated(payload.data);
      appToast.success("Đã tạo yêu cầu di chuyển");
      onClose();
    } catch (error) {
      console.error("[createMigrationRequest]", error);
      appToast.error("Lỗi kết nối khi tạo yêu cầu di chuyển");
    } finally {
      setSaving(false);
    }
  }

  return (
    <CreateFlowDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Tạo yêu cầu di chuyển"
      description="Tạo request migration đúng service type, có kiểm tra slot và chuẩn bị sẵn cho audit/history."
      size="xl"
      footer={
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)] px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Điều kiện bắt buộc</p>
            <p className="text-[12px] font-semibold text-[var(--fg-base)]">Kho nguồn và kho đích phải cùng dịch vụ, còn slot và không trùng nhau.</p>
          </div>
          <CreateActionFooter
            primaryLabel="Tạo yêu cầu"
            onPrimary={() => void handleSubmit()}
            onCancel={onClose}
            pending={saving}
            disabled={!selectedSubscriptionId || !selectedTargetAccountId || !reason.trim()}
          />
        </div>
      }
    >
      <CreateFormSection
        title="Thông tin chính"
        description="Chọn đúng thuê bao nguồn và kho đích. Danh sách kho đích đã được lọc theo service type và slot khả dụng."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
              Thuê bao cần di chuyển
            </label>
            <SmartSelector
              items={subscriptions.filter((item) => item.status === "active").map(subscriptionLabel)}
              value={selectedSubscriptionId}
              onSelect={(item) => setSelectedSubscriptionId(item.id)}
              placeholder="Tìm thuê bao theo khách hàng / dịch vụ..."
              createLabel="Không có thuê bao phù hợp"
              className="w-full"
            />
            {selectedSubscription ? (
              <p className="text-[11px] leading-6 text-[var(--fg-muted)]">
                Kho nguồn: {selectedSubscription.account_email} | Dịch vụ: {selectedSubscription.service_name} | Còn{" "}
                {Math.max(0, selectedSubscription.days_remaining)} ngày
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Kho đích</label>
            <SmartSelector
              items={eligibleTargetAccounts.map(migrationAccountLabel)}
              value={selectedTargetAccountId}
              onSelect={(item) => setSelectedTargetAccountId(item.id)}
              placeholder={selectedSubscription ? "Chọn kho cùng dịch vụ..." : "Chọn thuê bao trước"}
              createLabel="Chưa có kho đích phù hợp"
              className="w-full"
              disabled={!selectedSubscription}
            />
            {selectedTargetAccount ? (
              <p className="text-[11px] leading-6 text-[var(--fg-muted)]">
                Còn {selectedTargetAccount.available_slots} slot khả dụng | {selectedTargetAccount.service?.name ?? "Dịch vụ"}
              </p>
            ) : null}
            {selectedSubscription && eligibleTargetAccounts.length === 0 ? (
              <p className="text-[11px] font-medium text-[var(--danger)]">
                Không có kho đích phù hợp cùng dịch vụ hoặc còn slot trống.
              </p>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
            Lý do di chuyển <span className="text-[var(--danger)]">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ví dụ: Kho nguồn sắp hết slot, cần gom về kho mới..."
            className="min-h-[112px] w-full rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-3 text-[13px] font-medium text-[var(--fg-base)] outline-none transition-colors placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>
      </CreateFormSection>

      <AdvancedOptionsDisclosure>
        <div className="space-y-2">
          <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Ghi chú nội bộ</label>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Ghi chú nội bộ, ví dụ: giữ nguyên chu kỳ thanh toán..."
            className="min-h-[96px] w-full rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-3 text-[13px] font-medium text-[var(--fg-base)] outline-none transition-colors placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>
      </AdvancedOptionsDisclosure>

      <CreateFormSection
        title="Kiểm tra nhanh"
        description="Tóm tắt nhanh trước khi bắn request để vận hành thấy rõ nguồn, đích và sức chứa."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)] p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Nguồn</p>
            <p className="mt-1 text-[13px] font-bold text-[var(--fg-base)]">{selectedSubscription?.account_email ?? "Chưa chọn"}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)] p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Đích</p>
            <p className="mt-1 text-[13px] font-bold text-[var(--fg-base)]">{selectedTargetAccount?.primary_email ?? "Chưa chọn"}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)] p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Slot đích</p>
            <p className="mt-1 text-[13px] font-bold text-[var(--fg-base)]">
              {selectedTargetAccount ? `${selectedTargetAccount.available_slots} slot` : "Chưa có"}
            </p>
          </div>
        </div>
      </CreateFormSection>
    </CreateFlowDialog>
  );
}

function MigrationDetailModal({
  migration,
  accounts,
  onChanged,
}: {
  migration: MigrationDetailRow;
  accounts: MigrationAccountRow[];
  onChanged: (migration: MigrationDetailRow) => void;
}) {
  const router = useRouter();
  const [metadataForm, setMetadataForm] = useState({
    targetAccountId: migration.target_account_id,
    reason: migration.reason ?? "",
    notes: migration.notes ?? "",
  });
  const [executionForm, setExecutionForm] = useState({
    targetUserId: migration.target_user_id ?? "",
    createTargetUserEmail: "",
    failureReason: "",
  });
  const [targetUsers, setTargetUsers] = useState<PremiumAccountDetailViewModel["users"]>([]);
  const [isLoadingTargetUsers, setIsLoadingTargetUsers] = useState(false);
  const [mutationAction, setMutationAction] = useState<null | "metadata" | "start" | "complete" | "fail" | "cancel">(null);

  useEffect(() => {
    setMetadataForm({
      targetAccountId: migration.target_account_id,
      reason: migration.reason ?? "",
      notes: migration.notes ?? "",
    });
    setExecutionForm({
      targetUserId: migration.target_user_id ?? "",
      createTargetUserEmail: "",
      failureReason: "",
    });
  }, [migration]);

  useEffect(() => {
    const targetAccountId = metadataForm.targetAccountId || migration.target_account_id;
    if (!targetAccountId) {
      setTargetUsers([]);
      return;
    }

    let cancelled = false;
    setIsLoadingTargetUsers(true);

    void (async () => {
      try {
        const response = await fetch(`/api/premium/accounts/${targetAccountId}?audit_limit=1`);
        const payload = await readApiEnvelope<PremiumAccountDetailViewModel>(response);

        if (!response.ok || !payload.data) {
          if (!cancelled) {
            setTargetUsers([]);
          }
          return;
        }

        if (!cancelled) {
          setTargetUsers(payload.data.users);
        }
      } catch (error) {
        console.error("[loadMigrationTargetUsers]", error);
        if (!cancelled) {
          setTargetUsers([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingTargetUsers(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [metadataForm.targetAccountId, migration.target_account_id]);

  const stepSummary = useMemo(
    () =>
      migration.steps.reduce(
        (acc, step) => {
          acc.total += 1;
          acc[step.step_status] += 1;
          return acc;
        },
        { total: 0, pending: 0, in_progress: 0, completed: 0, failed: 0 },
      ),
    [migration.steps],
  );

  const sourceAvailableSlots = calculateAvailableSlots(
    migration.source_account?.total_slots ?? 0,
    migration.source_account?.used_slots ?? 0,
  );
  const targetAvailableSlots = calculateAvailableSlots(
    migration.target_account?.total_slots ?? 0,
    migration.target_account?.used_slots ?? 0,
  );
  const eligibleTargetAccounts = useMemo(
    () =>
      accounts.filter((account) => {
        const sameServiceType =
          !migration.source_account?.service_type_id ||
          account.service_type_id === migration.source_account.service_type_id;
        return account.id !== migration.source_account_id && account.status === "active" && sameServiceType;
      }),
    [accounts, migration.source_account?.service_type_id, migration.source_account_id],
  );
  const selectedTargetAccount =
    accounts.find((account) => account.id === metadataForm.targetAccountId) ?? migration.target_account ?? null;
  const activeTargetUsers = targetUsers.filter((user) => user.status === "active");
  const requiresTargetUser =
    Boolean(migration.source_user_id) ||
    (selectedTargetAccount?.used_slots ?? migration.target_account?.used_slots ?? 0) > 0 ||
    activeTargetUsers.length > 0;
  const canMutateLifecycle = migration.status === "pending" || migration.status === "in_progress";
  const terminalReason =
    migration.terminal_reason ??
    (typeof migration.details?.terminal_reason === "string" ? migration.details.terminal_reason : null);

  async function copyMigrationId() {
    try {
      await navigator.clipboard.writeText(migration.id);
      appToast.success("Đã sao chép ID migration");
    } catch (error) {
      console.error("[copyMigrationId]", error);
      appToast.error("Không thể sao chép vào clipboard");
    }
  }

  async function copyValue(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value);
      appToast.success(successMessage);
    } catch (error) {
      console.error("[copyMigrationValue]", error);
      appToast.error("Không thể sao chép vào clipboard");
    }
  }

  async function patchMigration(
    action: "metadata" | "start" | "complete" | "fail" | "cancel",
    payload: Record<string, unknown>,
    successMessage: string,
  ) {
    setMutationAction(action);
    try {
      const response = await fetch(`/api/premium/migrations/${migration.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const apiPayload = await readApiEnvelope<MigrationDetailRow>(response);

      if (!response.ok || !apiPayload.data) {
        appToast.error(apiPayload.error ?? "Không thể cập nhật migration");
        return;
      }

      onChanged(apiPayload.data);
      appToast.success(successMessage);
    } catch (error) {
      console.error("[patchPremiumMigration]", error);
      appToast.error("Lỗi kết nối khi cập nhật migration");
    } finally {
      setMutationAction(null);
    }
  }

  async function handleSaveMetadata() {
    if (migration.status !== "pending") {
      appToast.error("Chỉ migration pending mới được chỉnh request");
      return;
    }

    if (!metadataForm.targetAccountId || !metadataForm.reason.trim()) {
      appToast.error("Cần chọn kho đích và nhập lý do trước khi lưu");
      return;
    }

    await patchMigration(
      "metadata",
      {
        target_account_id: metadataForm.targetAccountId,
        reason: metadataForm.reason.trim(),
        notes: metadataForm.notes.trim() || null,
      },
      "Đã cập nhật request migration",
    );
  }

  async function handleComplete() {
    const payload: Record<string, unknown> = { action: "complete" };

    if (executionForm.targetUserId) {
      payload.target_user_id = executionForm.targetUserId;
    } else if (executionForm.createTargetUserEmail.trim()) {
      payload.create_target_user = {
        user_email: executionForm.createTargetUserEmail.trim(),
      };
    }

    if (requiresTargetUser && !payload.target_user_id && !payload.create_target_user) {
      appToast.error("Cần chọn target user hoặc tạo sub-user mới trước khi complete");
      return;
    }

    await patchMigration("complete", payload, "Đã hoàn tất migration");
  }

  async function handleFail() {
    if (!executionForm.failureReason.trim()) {
      appToast.error("Nhập lý do thất bại trước khi fail migration");
      return;
    }

    await patchMigration(
      "fail",
      {
        action: "fail",
        failure_reason: executionForm.failureReason.trim(),
      },
      "Đã kết thúc migration với trạng thái thất bại",
    );
  }

  return (
    <div className="custom-scrollbar max-h-[70vh] space-y-5 overflow-y-auto pr-1">
      <div className="grid gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Migration ID</p>
              <p className="mt-1 break-all text-[13px] font-bold text-[var(--fg-base)]">{migration.id}</p>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void copyMigrationId()}
              className="inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-[11px] font-bold"
            >
              <Copy className="size-4" />
              Sao chép
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Khách hàng</p>
          <p className="mt-1 text-[16px] font-black text-[var(--fg-base)]">{migration.customer_name}</p>
          <p className="mt-1 text-[12px] text-[var(--fg-muted)]">Mã khách hàng: {migration.customer_id}</p>
          <p className="mt-1 text-[12px] text-[var(--fg-muted)]">Mã subscription: {migration.subscription_id}</p>
        </div>

        <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Trạng thái</p>
          <span
            className={`mt-2 inline-flex rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-widest ${getStatusClass(migration.status)}`}
          >
            {getMigrationStatusLabel(migration)}
          </span>
          <p className="mt-2 text-[12px] text-[var(--fg-muted)]">Tạo lúc: {formatDateTime(migration.created_at)}</p>
          {terminalReason ? (
            <p className="mt-2 text-[12px] font-medium text-[var(--fg-muted)]">terminal_reason: {terminalReason}</p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Tổng bước</p>
          <p className="mt-1 text-[24px] font-black text-[var(--fg-base)]">{stepSummary.total}</p>
          <p className="mt-1 text-[12px] text-[var(--fg-muted)]">
            {stepSummary.completed} hoàn tất | {stepSummary.in_progress} đang xử lý | {stepSummary.failed} thất bại
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push(`/customers/${migration.customer_id}`)}
          className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-[11px] font-bold"
        >
          Xem khách hàng
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void copyValue(migration.customer_id, "Đã sao chép ID khách hàng")}
          className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-[11px] font-bold"
        >
          <Copy className="size-4" />
          Sao chép ID khách hàng
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void copyValue(migration.subscription_id, "Đã sao chép ID subscription")}
          className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-[11px] font-bold"
        >
          <Copy className="size-4" />
          Sao chép subscription
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void copyMigrationId()}
          className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-[11px] font-bold"
        >
          <Copy className="size-4" />
          Sao chép migration
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Nguồn</p>
          <p className="mt-1 break-all text-[13px] font-bold text-[var(--fg-base)]">
            {migration.source_account_email ?? migration.source_account?.primary_email ?? "N/A"}
          </p>
          <p className="mt-2 text-[12px] text-[var(--fg-muted)]">
            Service type: {migration.source_account?.service_type_id ?? "N/A"} | Slot: {migration.source_account?.used_slots ?? 0}/
            {migration.source_account?.total_slots ?? 0} | Còn {sourceAvailableSlots} slot
          </p>
          {migration.source_account?.id ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push(`/premium/accounts/${migration.source_account?.id}`)}
              className="mt-3 inline-flex rounded-full px-3 py-2 text-[11px] font-bold"
            >
              Xem kho nguồn
            </Button>
          ) : null}
        </div>

        <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Đích</p>
          <p className="mt-1 break-all text-[13px] font-bold text-[var(--fg-base)]">
            {migration.target_account_email ?? migration.target_account?.primary_email ?? "N/A"}
          </p>
          <p className="mt-2 text-[12px] text-[var(--fg-muted)]">
            Service type: {migration.target_account?.service_type_id ?? "N/A"} | Slot: {migration.target_account?.used_slots ?? 0}/
            {migration.target_account?.total_slots ?? 0} | Còn {targetAvailableSlots} slot
          </p>
          {migration.target_account?.id ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push(`/premium/accounts/${migration.target_account?.id}`)}
              className="mt-3 inline-flex rounded-full px-3 py-2 text-[11px] font-bold"
            >
              Xem kho đích
            </Button>
          ) : null}
        </div>

        <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Lý do</p>
          <p className="mt-1 text-[13px] font-semibold text-[var(--fg-base)]">{migration.reason ?? "N/A"}</p>
          {migration.notes ? <p className="mt-3 text-[12px] text-[var(--fg-muted)]">{migration.notes}</p> : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Request metadata</p>
              <p className="mt-1 text-[13px] font-semibold text-[var(--fg-base)]">
                Chỉnh kho đích, lý do và notes khi request còn pending.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              disabled={migration.status !== "pending"}
              isLoading={mutationAction === "metadata"}
              onClick={() => void handleSaveMetadata()}
              className="rounded-full px-3 py-2 text-[11px] font-bold"
            >
              <Save className="size-4" />
              Lưu request
            </Button>
          </div>

          <div className="mt-4 grid gap-3">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Kho đích</label>
              <Select
                value={metadataForm.targetAccountId}
                disabled={migration.status !== "pending"}
                onChange={(event) => {
                  setMetadataForm((current) => ({ ...current, targetAccountId: event.target.value }));
                  setExecutionForm((current) => ({ ...current, targetUserId: "", createTargetUserEmail: "" }));
                }}
              >
                {eligibleTargetAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.primary_email} · {account.service?.name ?? "Dịch vụ"}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Lý do</label>
              <textarea
                value={metadataForm.reason}
                disabled={migration.status !== "pending"}
                onChange={(event) => setMetadataForm((current) => ({ ...current, reason: event.target.value }))}
                className="min-h-[96px] w-full rounded-ios-sm border border-[var(--border-soft)] bg-white px-3 py-2.5 text-[13px] font-medium text-[var(--fg-base)] outline-none transition-colors placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Notes</label>
              <textarea
                value={metadataForm.notes}
                disabled={migration.status !== "pending"}
                onChange={(event) => setMetadataForm((current) => ({ ...current, notes: event.target.value }))}
                className="min-h-[88px] w-full rounded-ios-sm border border-[var(--border-soft)] bg-white px-3 py-2.5 text-[13px] font-medium text-[var(--fg-base)] outline-none transition-colors placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Execution controls</p>
              <p className="mt-1 text-[13px] font-semibold text-[var(--fg-base)]">
                Start, complete, fail hoặc cancel migration với target user assignment và audit đồng nhất.
              </p>
            </div>
            <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-light)] px-3 py-1 text-[11px] font-bold text-[var(--fg-base)]">
              {canMutateLifecycle ? "Open workflow" : "Read only"}
            </span>
          </div>

          <div className="mt-4 space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)] p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Kho đích đang chọn</p>
                <p className="mt-1 text-[13px] font-bold text-[var(--fg-base)]">
                  {selectedTargetAccount?.primary_email ?? "Chưa có"}
                </p>
                <p className="mt-1 text-[12px] text-[var(--fg-muted)]">
                  Còn {selectedTargetAccount ? calculateAvailableSlots(selectedTargetAccount.total_slots, selectedTargetAccount.used_slots) : 0} slot
                </p>
              </div>

              <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)] p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Target user requirement</p>
                <p className="mt-1 text-[13px] font-bold text-[var(--fg-base)]">{requiresTargetUser ? "Bắt buộc" : "Không bắt buộc"}</p>
                <p className="mt-1 text-[12px] text-[var(--fg-muted)]">
                  {isLoadingTargetUsers ? "Đang tải target users..." : `${activeTargetUsers.length} user active khả dụng`}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Target user hiện có</label>
              <Select
                value={executionForm.targetUserId}
                disabled={!canMutateLifecycle || isLoadingTargetUsers}
                onChange={(event) =>
                  setExecutionForm((current) => ({
                    ...current,
                    targetUserId: event.target.value,
                    createTargetUserEmail: event.target.value ? "" : current.createTargetUserEmail,
                  }))
                }
              >
                <option value="">Không chọn user có sẵn</option>
                {activeTargetUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.user_email}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Hoặc tạo target sub-user mới</label>
              <Input
                value={executionForm.createTargetUserEmail}
                disabled={!canMutateLifecycle || Boolean(executionForm.targetUserId)}
                placeholder="target-user@example.com"
                onChange={(event) =>
                  setExecutionForm((current) => ({ ...current, createTargetUserEmail: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Lý do fail</label>
              <textarea
                value={executionForm.failureReason}
                disabled={!canMutateLifecycle}
                onChange={(event) =>
                  setExecutionForm((current) => ({ ...current, failureReason: event.target.value }))
                }
                placeholder="Bắt buộc khi kết thúc thất bại."
                className="min-h-[88px] w-full rounded-ios-sm border border-[var(--border-soft)] bg-[var(--surface-light)] px-3 py-2.5 text-[13px] font-medium text-[var(--fg-base)] outline-none transition-colors placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={migration.status !== "pending"}
                isLoading={mutationAction === "start"}
                onClick={() => void patchMigration("start", { action: "start" }, "Đã bắt đầu migration")}
              >
                <Play className="size-4" />
                Start
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={!canMutateLifecycle}
                isLoading={mutationAction === "complete"}
                onClick={() => void handleComplete()}
              >
                <CheckCircle2 className="size-4" />
                Complete
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={!canMutateLifecycle}
                isLoading={mutationAction === "fail"}
                onClick={() => void handleFail()}
              >
                <ShieldAlert className="size-4" />
                Fail
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={!canMutateLifecycle}
                isLoading={mutationAction === "cancel"}
                onClick={() =>
                  void patchMigration("cancel", { action: "cancel" }, "Đã hủy migration theo yêu cầu admin")
                }
              >
                <XCircle className="size-4" />
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>

      {migration.notes ? (
        <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Ghi chú</p>
          <p className="mt-2 whitespace-pre-wrap text-[13px] text-[var(--fg-base)]">{migration.notes}</p>
        </div>
      ) : null}

      <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <ClipboardList className="size-4 text-[var(--accent)]" />
          <h3 className="text-[14px] font-bold text-[var(--fg-base)]">Lịch sử bước di chuyển</h3>
        </div>

        <div className="space-y-3">
          {migration.steps.length === 0 ? (
            <p className="text-[13px] text-[var(--fg-muted)]">Chưa có bước audit nào.</p>
          ) : (
            migration.steps.map((step) => (
              <div
                key={`${step.step_number}-${step.step_name}`}
                className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)] p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[12px] font-black uppercase tracking-widest text-[var(--fg-muted)]">Bước {step.step_number}</p>
                    <p className="mt-1 text-[14px] font-bold text-[var(--fg-base)]">{step.step_name}</p>
                  </div>
                  <span
                    className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${getStepStatusClass(step.step_status)}`}
                  >
                    {step.step_status}
                  </span>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Bắt đầu</p>
                    <p className="mt-1 text-[12px] font-medium text-[var(--fg-base)]">{formatDateTime(step.started_at)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Hoàn tất</p>
                    <p className="mt-1 text-[12px] font-medium text-[var(--fg-base)]">{formatDateTime(step.completed_at)}</p>
                  </div>
                </div>

                {step.error_message ? (
                  <p className="mt-3 rounded-xl border border-[var(--danger)]/20 bg-[var(--danger)]/5 px-3 py-2 text-[12px] font-medium text-[var(--danger)]">
                    {step.error_message}
                  </p>
                ) : null}

                <pre className="custom-scrollbar mt-3 max-h-48 overflow-auto rounded-xl border border-[var(--border-soft)] bg-white p-3 text-[11px] leading-5 text-[var(--fg-base)]">
                  {jsonPreview(step.details)}
                </pre>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Audit chi tiết</p>
          <pre className="custom-scrollbar mt-2 max-h-48 overflow-auto rounded-xl border border-[var(--border-soft)] bg-white p-3 text-[11px] leading-5 text-[var(--fg-base)]">
            {jsonPreview(migration.details)}
          </pre>
        </div>
        <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Nguồn / Đích</p>
          <pre className="custom-scrollbar mt-2 max-h-48 overflow-auto rounded-xl border border-[var(--border-soft)] bg-white p-3 text-[11px] leading-5 text-[var(--fg-base)]">
            {jsonPreview({
              source: migration.source_account,
              target: migration.target_account,
            })}
          </pre>
        </div>
      </div>
    </div>
  );
}

export function MigrationModals({
  isCreateOpen,
  onCloseCreate,
  subscriptions,
  accounts,
  onCreated,
  detailLoading,
  detailMigration,
  onDetailChanged,
  onCloseDetail,
}: {
  isCreateOpen: boolean;
  onCloseCreate: () => void;
  subscriptions: MigrationSubscriptionRow[];
  accounts: MigrationAccountRow[];
  onCreated: (migration: MigrationListRow) => void;
  detailLoading: boolean;
  detailMigration: MigrationDetailRow | null;
  onDetailChanged: (migration: MigrationDetailRow) => void;
  onCloseDetail: () => void;
}) {
  return (
    <>
      <Modal isOpen={detailLoading || Boolean(detailMigration)} onClose={onCloseDetail} title="Audit di chuyển" size="2xl">
        {detailLoading ? (
          <div className="flex min-h-56 items-center justify-center">
            <Loader2 className="size-8 animate-spin text-[var(--accent)]" />
          </div>
        ) : detailMigration ? (
          <MigrationDetailModal migration={detailMigration} accounts={accounts} onChanged={onDetailChanged} />
        ) : null}
      </Modal>

      <MigrationRequestModal
        isOpen={isCreateOpen}
        onClose={onCloseCreate}
        subscriptions={subscriptions}
        accounts={accounts}
        onCreated={onCreated}
      />
    </>
  );
}
