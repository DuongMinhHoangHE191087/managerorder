"use client";

import { ArrowRightLeft, ClipboardList, Copy, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { calculateAvailableSlots } from "@/lib/domain/premium-account-math";
import { appToast } from "@/shared/lib/toast";
import { readApiEnvelope } from "@/shared/lib/api-client";
import { Button } from "@/shared/ui/button";
import { Modal } from "@/shared/ui/modal";
import { SmartSelector } from "@/shared/ui/smart-selector";
import type {
  MigrationAccountRow,
  MigrationDetailRow,
  MigrationListRow,
  MigrationSubscriptionRow,
} from "../types";
import {
  formatDateTime,
  getStatusClass,
  getStatusLabel,
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Tạo yêu cầu di chuyển"
      size="2xl"
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)] px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Điều kiện</p>
              <p className="text-[12px] font-semibold text-[var(--fg-base)]">Chỉ tạo khi kho nguồn và kho đích cùng dịch vụ</p>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">
              Huỷ
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={saving || !selectedSubscriptionId || !selectedTargetAccountId || !reason.trim()}
              className="w-full sm:w-auto"
            >
              <ArrowRightLeft className="size-4" />
              {saving ? "Đang tạo..." : "Tạo yêu cầu"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="custom-scrollbar max-h-[68vh] space-y-5 overflow-y-auto pr-1">
        <div className="grid gap-4 lg:grid-cols-2">
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
              <p className="text-[11px] text-[var(--fg-muted)]">
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
              <p className="text-[11px] text-[var(--fg-muted)]">
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
          <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Lý do di chuyển</label>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ví dụ: Kho nguồn sắp hết slot, cần gom về kho mới..."
            className="min-h-[104px] w-full rounded-ios-sm border border-[var(--border-soft)] bg-[var(--bg-surface)] px-3 py-2.5 text-[13px] font-medium text-[var(--fg-base)] outline-none transition-colors placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Ghi chú</label>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Ghi chú nội bộ, ví dụ: giữ nguyên chu kỳ thanh toán..."
            className="min-h-[88px] w-full rounded-ios-sm border border-[var(--border-soft)] bg-[var(--surface-light)] px-3 py-2.5 text-[13px] font-medium text-[var(--fg-base)] outline-none transition-colors placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>

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
      </div>
    </Modal>
  );
}

function MigrationDetailModal({ migration }: { migration: MigrationDetailRow }) {
  const router = useRouter();
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
            {getStatusLabel(migration.status)}
          </span>
          <p className="mt-2 text-[12px] text-[var(--fg-muted)]">Tạo lúc: {formatDateTime(migration.created_at)}</p>
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
              onClick={() => router.push(`/inventory/source-accounts/${migration.source_account?.id}`)}
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
              onClick={() => router.push(`/inventory/source-accounts/${migration.target_account?.id}`)}
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
  onCloseDetail,
}: {
  isCreateOpen: boolean;
  onCloseCreate: () => void;
  subscriptions: MigrationSubscriptionRow[];
  accounts: MigrationAccountRow[];
  onCreated: (migration: MigrationListRow) => void;
  detailLoading: boolean;
  detailMigration: MigrationDetailRow | null;
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
          <MigrationDetailModal migration={detailMigration} />
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
