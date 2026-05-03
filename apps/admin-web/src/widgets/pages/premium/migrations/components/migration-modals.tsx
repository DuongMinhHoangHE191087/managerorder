"use client";

import {
  CheckCircle2,
  ArrowRightLeft,
  ClipboardList,
  Copy,
  CalendarClock,
  ExternalLink,
  Loader2,
  Play,
  Save,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
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
import { PREMIUM_MIGRATION_COPY as copy } from "../copy";
import type {
  MigrationAccountRow,
  MigrationDetailRow,
  MigrationListRow,
  MigrationSubscriptionRow,
} from "../types";
import {
  formatDateTime,
  getMigrationStatusLabel,
  getMigrationPhaseLabel,
  getStatusClass,
  getStepStatusClass,
  getMigrationStepLabel,
  getMigrationStepStatusLabel,
  getTerminalReasonLabel,
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
      appToast.success("Đã tạo yêu cầu chuyển đổi");
      onClose();
    } catch (error) {
      console.error("[createMigrationRequest]", error);
      appToast.error("Lỗi kết nối khi tạo yêu cầu chuyển đổi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <CreateFlowDialog
      isOpen={isOpen}
      onClose={onClose}
      title={copy.request.title}
      description={copy.request.description}
      size="xl"
      footer={
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)] px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">{copy.request.conditionsTitle}</p>
            <p className="text-[12px] font-semibold text-[var(--fg-base)]">{copy.request.conditionsDescription}</p>
          </div>
          <CreateActionFooter
            primaryLabel={copy.request.submit}
            onPrimary={() => void handleSubmit()}
            onCancel={onClose}
            pending={saving}
            disabled={!selectedSubscriptionId || !selectedTargetAccountId || !reason.trim()}
          />
        </div>
      }
    >
      <CreateFormSection
        title={copy.request.mainSectionTitle}
      description={copy.request.mainSectionDescription}
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
              {copy.request.sourceSubscriptionLabel}
            </label>
            <SmartSelector
              items={subscriptions.filter((item) => item.status === "active").map(subscriptionLabel)}
              value={selectedSubscriptionId}
              onSelect={(item) => setSelectedSubscriptionId(item.id)}
              placeholder={copy.request.sourceSubscriptionPlaceholder}
              createLabel={copy.request.sourceSubscriptionEmpty}
              className="w-full"
            />
            {selectedSubscription ? (
              <p className="text-[11px] leading-6 text-[var(--fg-muted)]">
                {copy.request.sourceSummaryPrefix} {selectedSubscription.account_email} | {copy.request.sourceServicePrefix} {selectedSubscription.service_name} | Còn{" "}
                {Math.max(0, selectedSubscription.days_remaining)} {copy.request.daysRemainingSuffix}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
              {copy.request.targetAccountLabel}
            </label>
            <SmartSelector
              items={eligibleTargetAccounts.map(migrationAccountLabel)}
              value={selectedTargetAccountId}
              onSelect={(item) => setSelectedTargetAccountId(item.id)}
              placeholder={
                selectedSubscription ? copy.request.targetAccountPlaceholder.withSubscription : copy.request.targetAccountPlaceholder.withoutSubscription
              }
              createLabel={copy.request.targetAccountEmpty}
              className="w-full"
              disabled={!selectedSubscription}
            />
            {selectedTargetAccount ? (
              <p className="text-[11px] leading-6 text-[var(--fg-muted)]">
                {copy.request.targetSummary(selectedTargetAccount.available_slots, selectedTargetAccount.service?.name ?? "Dịch vụ")}
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
            {copy.request.reasonLabel} <span className="text-[var(--danger)]">*</span>
            </label>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={copy.request.reasonPlaceholder}
            className="min-h-[112px] w-full rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-3 text-[13px] font-medium text-[var(--fg-base)] outline-none transition-colors placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>
      </CreateFormSection>

      <AdvancedOptionsDisclosure>
        <div className="space-y-2">
          <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">{copy.request.notesLabel}</label>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={copy.request.notesPlaceholder}
            className="min-h-[96px] w-full rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-3 text-[13px] font-medium text-[var(--fg-base)] outline-none transition-colors placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>
      </AdvancedOptionsDisclosure>

      <CreateFormSection
        title={copy.request.quickCheckTitle}
        description={copy.request.quickCheckDescription}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)] p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">{copy.request.quickCheckSource}</p>
            <p className="mt-1 text-[13px] font-bold text-[var(--fg-base)]">{selectedSubscription?.account_email ?? copy.request.noSubscription}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)] p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">{copy.request.quickCheckTarget}</p>
            <p className="mt-1 text-[13px] font-bold text-[var(--fg-base)]">{selectedTargetAccount?.primary_email ?? copy.request.noSubscription}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)] p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">{copy.request.quickCheckCapacity}</p>
            <p className="mt-1 text-[13px] font-bold text-[var(--fg-base)]">
              {selectedTargetAccount ? copy.request.quickCheckCapacityValue(selectedTargetAccount.available_slots) : copy.request.quickCheckEmptyValue}
            </p>
          </div>
        </div>
      </CreateFormSection>
    </CreateFlowDialog>
  );
}

function SectionCard({
  eyebrow,
  title,
  description,
  children,
  className = "",
}: {
  eyebrow: string;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-[28px] border border-[var(--border-soft)] bg-white p-5 shadow-sm ${className}`}>
      <div className="mb-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">{eyebrow}</p>
        {title ? <p className="mt-1 text-[13px] font-semibold text-[var(--fg-base)]">{title}</p> : null}
        {description ? <p className="mt-1 text-[12px] text-[var(--fg-muted)]">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function StatTile({
  label,
  value,
  note,
  className = "",
}: {
  label: string;
  value: string | number;
  note?: string;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)] p-4 ${className}`}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">{label}</p>
      <p className="mt-2 text-[22px] font-black leading-none text-[var(--fg-base)]">{value}</p>
      {note ? <p className="mt-2 text-[12px] text-[var(--fg-muted)]">{note}</p> : null}
    </div>
  );
}

function DetailTile({
  label,
  value,
  action,
  mono = false,
  className = "",
}: {
  label: string;
  value: ReactNode;
  action?: ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)] p-4 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">{label}</p>
          <p
            className={`mt-2 text-[13px] font-bold text-[var(--fg-base)] ${mono ? "break-words font-mono text-[12px] leading-5" : ""}`}
          >
            {value}
          </p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
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
          account.service_type_id === migration.source_account?.service_type_id;
        return account.id !== migration.source_account_id && account.status === "active" && sameServiceType;
      }),
    [accounts, migration.source_account?.service_type_id, migration.source_account_id],
  );
  const sourceAccountRecord = useMemo(
    () => accounts.find((account) => account.id === migration.source_account_id) ?? null,
    [accounts, migration.source_account_id],
  );
  const selectedTargetAccount =
    accounts.find((account) => account.id === metadataForm.targetAccountId) ?? migration.target_account ?? null;
  const targetAccountRecord = useMemo(
    () =>
      accounts.find((account) => account.id === metadataForm.targetAccountId) ??
      accounts.find((account) => account.id === migration.target_account_id) ??
      null,
    [accounts, metadataForm.targetAccountId, migration.target_account_id],
  );
  const activeTargetUsers = targetUsers.filter((user) => user.status === "active");
  const requiresTargetUser =
    Boolean(migration.source_user_id) ||
    (selectedTargetAccount?.used_slots ?? migration.target_account?.used_slots ?? 0) > 0 ||
    activeTargetUsers.length > 0;
  const canMutateLifecycle = migration.status === "pending" || migration.status === "in_progress";
  const sourceAccountId = sourceAccountRecord?.id ?? migration.source_account?.id ?? null;
  const targetAccountId = targetAccountRecord?.id ?? selectedTargetAccount?.id ?? null;
  const sourceAccountSummary = sourceAccountRecord ? migrationAccountLabel(sourceAccountRecord) : null;
  const targetAccountSummary = targetAccountRecord ? migrationAccountLabel(targetAccountRecord) : null;
  const terminalReason =
    migration.terminal_reason ??
    (typeof migration.details?.terminal_reason === "string" ? migration.details.terminal_reason : null);

  async function copyMigrationId() {
    try {
      await navigator.clipboard.writeText(migration.id);
      appToast.success(copy.detail.overview.copyMigrationId);
    } catch (error) {
      console.error("[copyMigrationId]", error);
      appToast.error(copy.detail.copy.fallback);
    }
  }

  async function copyValue(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value);
      appToast.success(successMessage);
    } catch (error) {
      console.error("[copyMigrationValue]", error);
      appToast.error(copy.detail.copy.fallback);
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
        appToast.error(apiPayload.error ?? copy.detail.error.cannotUpdate);
        return;
      }

      onChanged(apiPayload.data);
      appToast.success(successMessage);
    } catch (error) {
      console.error("[patchPremiumMigration]", error);
      appToast.error(copy.detail.error.updateConnection);
    } finally {
      setMutationAction(null);
    }
  }

  async function handleSaveMetadata() {
    if (migration.status !== "pending") {
      appToast.error("Chỉ khi đang chờ xử lý mới được chỉnh yêu cầu.");
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
      "Đã cập nhật yêu cầu chuyển đổi",
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
      appToast.error(copy.detail.execution.validationNeedTargetUser);
      return;
    }

    await patchMigration("complete", payload, copy.detail.execution.completeToast);
  }

  async function handleFail() {
    if (!executionForm.failureReason.trim()) {
      appToast.error(copy.detail.execution.validationNeedFailureReason);
      return;
    }

    await patchMigration(
      "fail",
      {
        action: "fail",
        failure_reason: executionForm.failureReason.trim(),
      },
      copy.detail.execution.failToast,
    );
  }

  return (
    <div className="custom-scrollbar max-h-[70vh] space-y-5 overflow-y-auto pr-1">
      <div className="grid gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                {copy.detail.overview.migrationId}
              </p>
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
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">{copy.detail.overview.customerName}</p>
          <p className="mt-1 text-[16px] font-black text-[var(--fg-base)]">{migration.customer_name}</p>
          <p className="mt-1 text-[12px] text-[var(--fg-muted)]">
            {copy.detail.overview.customerId}: {migration.customer_id}
          </p>
          <p className="mt-1 text-[12px] text-[var(--fg-muted)]">
            {copy.detail.overview.subscriptionId}: {migration.subscription_id}
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">{copy.detail.summary.status}</p>
          <span
            className={`mt-2 inline-flex rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-widest ${getStatusClass(migration.status)}`}
          >
            {getMigrationStatusLabel(migration)}
          </span>
          <p className="mt-2 text-[12px] text-[var(--fg-muted)]">
            {copy.detail.overview.createdAt}: {formatDateTime(migration.created_at)}
          </p>
          {terminalReason ? (
            <p className="mt-2 text-[12px] font-medium text-[var(--fg-muted)]">
              {copy.detail.summary.reasonPrefix} {terminalReason}
            </p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">{copy.detail.summary.totalSteps}</p>
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
          {copy.list.viewCustomer}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void copyValue(migration.customer_id, "Đã sao chép mã khách hàng")}
          className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-[11px] font-bold"
        >
          <Copy className="size-4" />
          {copy.list.copyCustomerId}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void copyValue(migration.subscription_id, "Đã sao chép mã đăng ký")}
          className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-[11px] font-bold"
        >
          <Copy className="size-4" />
          {copy.list.copySubscription}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void copyMigrationId()}
          className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-[11px] font-bold"
        >
          <Copy className="size-4" />
          {copy.list.copyId}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
            {copy.detail.sourceTarget.sourceLabel}
          </p>
          <p className="mt-1 break-all text-[13px] font-bold text-[var(--fg-base)]">
            {migration.source_account_email ?? migration.source_account?.primary_email ?? "N/A"}
          </p>
          <p className="mt-2 text-[12px] text-[var(--fg-muted)]">
            Gói dịch vụ: {migration.source_account?.service_type_id ?? "N/A"} | {copy.detail.sourceTarget.capacity}:{" "}
            {migration.source_account?.used_slots ?? 0}/{migration.source_account?.total_slots ?? 0} | {copy.detail.sourceTarget.remaining}{" "}
            {sourceAvailableSlots} slot
          </p>
          {migration.source_account?.id ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push(`/premium/accounts/${migration.source_account?.id}`)}
              className="mt-3 inline-flex rounded-full px-3 py-2 text-[11px] font-bold"
            >
              {copy.detail.sourceTarget.open} {copy.detail.sourceTarget.sourceLabel.toLowerCase()}
            </Button>
          ) : null}
        </div>

        <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
            {copy.detail.sourceTarget.targetLabel}
          </p>
          <p className="mt-1 break-all text-[13px] font-bold text-[var(--fg-base)]">
            {migration.target_account_email ?? migration.target_account?.primary_email ?? "N/A"}
          </p>
          <p className="mt-2 text-[12px] text-[var(--fg-muted)]">
            Gói dịch vụ: {migration.target_account?.service_type_id ?? "N/A"} | {copy.detail.sourceTarget.capacity}:{" "}
            {migration.target_account?.used_slots ?? 0}/{migration.target_account?.total_slots ?? 0} | {copy.detail.sourceTarget.remaining}{" "}
            {targetAvailableSlots} slot
          </p>
          {migration.target_account?.id ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push(`/premium/accounts/${migration.target_account?.id}`)}
              className="mt-3 inline-flex rounded-full px-3 py-2 text-[11px] font-bold"
            >
              {copy.detail.sourceTarget.open} {copy.detail.sourceTarget.targetLabel.toLowerCase()}
            </Button>
          ) : null}
        </div>

        <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">{copy.request.reasonLabel}</p>
          <p className="mt-1 text-[13px] font-semibold text-[var(--fg-base)]">{migration.reason ?? "N/A"}</p>
          {migration.notes ? <p className="mt-3 text-[12px] text-[var(--fg-muted)]">{migration.notes}</p> : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                {copy.detail.requestSection.eyebrow}
              </p>
              <p className="mt-1 text-[13px] font-semibold text-[var(--fg-base)]">
                {copy.detail.requestSection.description}
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
              {copy.detail.requestSection.saveButton}
            </Button>
          </div>

          <div className="mt-4 grid gap-3">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                {copy.detail.requestSection.targetLabel}
              </label>
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
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                {copy.detail.requestSection.reasonLabel}
              </label>
              <textarea
                value={metadataForm.reason}
                disabled={migration.status !== "pending"}
                onChange={(event) => setMetadataForm((current) => ({ ...current, reason: event.target.value }))}
                className="min-h-[96px] w-full rounded-ios-sm border border-[var(--border-soft)] bg-white px-3 py-2.5 text-[13px] font-medium text-[var(--fg-base)] outline-none transition-colors placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                {copy.detail.requestSection.notesLabel}
              </label>
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
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                {copy.detail.execution.eyebrow}
              </p>
              <p className="mt-1 text-[13px] font-semibold text-[var(--fg-base)]">
                {copy.detail.execution.description}
              </p>
            </div>
            <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-light)] px-3 py-1 text-[11px] font-bold text-[var(--fg-base)]">
              {canMutateLifecycle ? copy.detail.execution.canMutate : copy.detail.execution.readOnly}
            </span>
          </div>

          <div className="mt-4 space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)] p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                  {copy.detail.execution.selectedTargetLabel}
                </p>
                <p className="mt-1 text-[13px] font-bold text-[var(--fg-base)]">
                  {selectedTargetAccount?.primary_email ?? "Chưa có"}
                </p>
                <p className="mt-1 text-[12px] text-[var(--fg-muted)]">
                  {copy.detail.sourceTarget.remaining}{" "}
                  {selectedTargetAccount
                    ? calculateAvailableSlots(selectedTargetAccount.total_slots, selectedTargetAccount.used_slots)
                    : 0}{" "}
                  slot
                </p>
              </div>

              <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)] p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                  {copy.detail.execution.requiresTargetUserLabel}
                </p>
                <p className="mt-1 text-[13px] font-bold text-[var(--fg-base)]">
                  {requiresTargetUser ? copy.detail.execution.requiresTargetUserRequired : copy.detail.execution.requiresTargetUserOptional}
                </p>
                <p className="mt-1 text-[12px] text-[var(--fg-muted)]">
                  {isLoadingTargetUsers
                    ? copy.detail.execution.loadingTargetUsers
                    : copy.detail.execution.targetUsersAvailable(activeTargetUsers.length)}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                {copy.detail.execution.existingTargetUserLabel}
              </label>
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
                <option value="">{copy.detail.execution.noExistingTargetUser}</option>
                {activeTargetUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.user_email}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                {copy.detail.execution.createNewTargetUserLabel}
              </label>
              <Input
                value={executionForm.createTargetUserEmail}
                disabled={!canMutateLifecycle || Boolean(executionForm.targetUserId)}
                placeholder={copy.detail.execution.createNewTargetUserPlaceholder}
                onChange={(event) =>
                  setExecutionForm((current) => ({ ...current, createTargetUserEmail: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                {copy.detail.execution.failureReasonLabel}
              </label>
              <textarea
                value={executionForm.failureReason}
                disabled={!canMutateLifecycle}
                onChange={(event) =>
                  setExecutionForm((current) => ({ ...current, failureReason: event.target.value }))
                }
                placeholder={copy.detail.execution.failureReasonPlaceholder}
                className="min-h-[88px] w-full rounded-ios-sm border border-[var(--border-soft)] bg-[var(--surface-light)] px-3 py-2.5 text-[13px] font-medium text-[var(--fg-base)] outline-none transition-colors placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={migration.status !== "pending"}
                isLoading={mutationAction === "start"}
                onClick={() => void patchMigration("start", { action: "start" }, copy.detail.execution.startToast)}
              >
                <Play className="size-4" />
                {copy.detail.execution.start}
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={!canMutateLifecycle}
                isLoading={mutationAction === "complete"}
                onClick={() => void handleComplete()}
              >
                <CheckCircle2 className="size-4" />
                {copy.detail.execution.complete}
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={!canMutateLifecycle}
                isLoading={mutationAction === "fail"}
                onClick={() => void handleFail()}
              >
                <ShieldAlert className="size-4" />
                {copy.detail.execution.fail}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={!canMutateLifecycle}
                isLoading={mutationAction === "cancel"}
                onClick={() => void patchMigration("cancel", { action: "cancel" }, copy.detail.execution.cancelToast)}
              >
                <XCircle className="size-4" />
                {copy.detail.execution.cancel}
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
          <h3 className="text-[14px] font-bold text-[var(--fg-base)]">{copy.detail.timeline.title}</h3>
        </div>

        <div className="space-y-3">
          {migration.steps.length === 0 ? (
            <p className="text-[13px] text-[var(--fg-muted)]">{copy.detail.timeline.empty}</p>
          ) : (
            migration.steps.map((step) => (
              <div
                key={`${step.step_number}-${step.step_name}`}
                className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)] p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[12px] font-black uppercase tracking-widest text-[var(--fg-muted)]">
                      {copy.detail.timeline.stepPrefix} {step.step_number}
                    </p>
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
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                      {copy.detail.summary.started}
                    </p>
                    <p className="mt-1 text-[12px] font-medium text-[var(--fg-base)]">{formatDateTime(step.started_at)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                      {copy.detail.summary.completed}
                    </p>
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
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Dữ liệu chi tiết</p>
          <pre className="custom-scrollbar mt-2 max-h-48 overflow-auto rounded-xl border border-[var(--border-soft)] bg-white p-3 text-[11px] leading-5 text-[var(--fg-base)]">
            {jsonPreview(migration.details)}
          </pre>
        </div>
        <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
            {copy.detail.sourceTarget.eyebrow}
          </p>
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

function MigrationDetailModalV2({
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
  const eligibleTargetAccounts = useMemo(
    () =>
      accounts.filter((account) => {
        const sameServiceType =
          !migration.source_account?.service_type_id ||
          account.service_type_id === migration.source_account?.service_type_id;
        return account.id !== migration.source_account_id && account.status === "active" && sameServiceType;
      }),
    [accounts, migration.source_account?.service_type_id, migration.source_account_id],
  );
  const sourceAccountRecord = useMemo(
    () => accounts.find((account) => account.id === migration.source_account_id) ?? null,
    [accounts, migration.source_account_id],
  );
  const selectedTargetAccount =
    accounts.find((account) => account.id === metadataForm.targetAccountId) ?? migration.target_account ?? null;
  const targetAccountRecord = useMemo(
    () =>
      accounts.find((account) => account.id === metadataForm.targetAccountId) ??
      accounts.find((account) => account.id === migration.target_account_id) ??
      null,
    [accounts, metadataForm.targetAccountId, migration.target_account_id],
  );
  const selectedTargetAvailableSlots = calculateAvailableSlots(
    selectedTargetAccount?.total_slots ?? 0,
    selectedTargetAccount?.used_slots ?? 0,
  );
  const activeTargetUsers = targetUsers.filter((user) => user.status === "active");
  const requiresTargetUser =
    Boolean(migration.source_user_id) ||
    (selectedTargetAccount?.used_slots ?? migration.target_account?.used_slots ?? 0) > 0 ||
    activeTargetUsers.length > 0;
  const canMutateLifecycle = migration.status === "pending" || migration.status === "in_progress";
  const sourceAccountId = sourceAccountRecord?.id ?? migration.source_account?.id ?? null;
  const targetAccountId = targetAccountRecord?.id ?? selectedTargetAccount?.id ?? null;
  const sourceAccountSummary = sourceAccountRecord ? migrationAccountLabel(sourceAccountRecord) : null;
  const targetAccountSummary = targetAccountRecord ? migrationAccountLabel(targetAccountRecord) : null;
  const terminalReason =
    migration.terminal_reason ??
    (typeof migration.details?.terminal_reason === "string" ? migration.details.terminal_reason : null);
  const terminalReasonLabel = getTerminalReasonLabel(terminalReason);
  const startedAt = migration.started_at ?? migration.created_at;
  const completedAt = migration.completed_at ?? null;

  const businessFacts = useMemo(
    () => [
      {
        label: "Giai đoạn",
        value:
          getMigrationPhaseLabel(
            typeof migration.details?.phase === "string" ? migration.details.phase : null,
          ) ?? "N/A",
      },
      {
        label: "Môi trường",
        value:
          typeof migration.details?.sandbox === "boolean"
            ? migration.details.sandbox
              ? "Sandbox"
              : "Production"
            : "N/A",
      },
      {
        label: "Người khởi tạo",
        value: migration.initiated_by ?? "N/A",
      },
      {
        label: "Bắt đầu lúc",
        value: formatDateTime(startedAt),
      },
      {
        label: "Hoàn tất lúc",
        value: formatDateTime(completedAt),
      },
      {
        label: "Nguồn user",
        value: migration.source_user_id ?? "N/A",
      },
      {
        label: "Đích user",
        value: migration.target_user_id ?? "N/A",
      },
      {
        label: "Người nhận mới",
        value:
          typeof migration.details?.created_target_user_id === "string"
            ? migration.details.created_target_user_id
            : "N/A",
      },
      {
        label: "Mã đăng ký hoàn tất",
        value:
          typeof migration.details?.completed_subscription_id === "string"
            ? migration.details.completed_subscription_id
            : "N/A",
      },
      {
        label: "Terminal reason",
        value: terminalReasonLabel ?? "N/A",
      },
      {
        label: "Error log",
        value: migration.error_log ?? "N/A",
      },
    ],
    [
      completedAt,
      migration.details,
      migration.error_log,
      migration.initiated_by,
      migration.source_user_id,
      migration.target_user_id,
      startedAt,
      terminalReasonLabel,
    ],
  );

  async function copyMigrationId() {
    try {
      await navigator.clipboard.writeText(migration.id);
      appToast.success("Đã sao chép mã chuyển đổi");
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
        appToast.error(apiPayload.error ?? "Không thể cập nhật chuyển đổi");
        return;
      }

      onChanged(apiPayload.data);
      appToast.success(successMessage);
    } catch (error) {
      console.error("[patchPremiumMigration]", error);
      appToast.error("Lỗi kết nối khi cập nhật chuyển đổi");
    } finally {
      setMutationAction(null);
    }
  }

  async function handleSaveMetadata() {
    if (migration.status !== "pending") {
      appToast.error("Chỉ khi đang chờ xử lý mới được chỉnh yêu cầu.");
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
      "Đã cập nhật yêu cầu chuyển đổi",
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
      appToast.error("Cần chọn người nhận hiện có hoặc tạo người nhận mới trước khi hoàn tất.");
      return;
    }

    await patchMigration("complete", payload, "Đã hoàn tất chuyển đổi");
  }

  async function handleFail() {
    if (!executionForm.failureReason.trim()) {
      appToast.error("Nhập lý do thất bại trước khi đánh dấu thất bại.");
      return;
    }

    await patchMigration(
      "fail",
      {
        action: "fail",
        failure_reason: executionForm.failureReason.trim(),
      },
      "Đã kết thúc chuyển đổi với trạng thái thất bại",
    );
  }

  return (
    <div className="custom-scrollbar max-h-[70vh] space-y-5 overflow-y-auto pr-1">
      <SectionCard
        eyebrow="Tổng quan"
        title="Tóm tắt hồ sơ chuyển đổi"
        description="Hồ sơ vận hành của lần chuyển thuê bao từ kho nguồn sang kho đích."
        className="bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(245,250,239,0.96))]"
      >
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-light)] px-3 py-1 text-[11px] font-black uppercase tracking-widest text-[var(--fg-muted)]">
                Hồ sơ chuyển đổi
              </span>
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-widest ${getStatusClass(migration.status)}`}
              >
                {getMigrationStatusLabel(migration)}
              </span>
              {terminalReasonLabel ? (
                <span className="inline-flex rounded-full border border-[var(--border-soft)] bg-white px-3 py-1 text-[11px] font-bold text-[var(--fg-muted)]">
                  {terminalReasonLabel}
                </span>
              ) : null}
            </div>

            <div className="space-y-2">
              <h3 className="truncate text-[24px] font-black tracking-tight text-[var(--fg-base)]">
                {migration.customer_name}
              </h3>
              <div className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-[var(--fg-muted)]">
                <span className="truncate">{migration.source_account_email ?? migration.source_account?.primary_email ?? "N/A"}</span>
                <ArrowRightLeft className="size-4 shrink-0" />
                <span className="truncate">{migration.target_account_email ?? selectedTargetAccount?.primary_email ?? "N/A"}</span>
              </div>
              <p className="max-w-3xl text-[13px] leading-6 text-[var(--fg-muted)]">
                {migration.reason ?? "Chưa có lý do được ghi nhận."}
              </p>
              {migration.notes ? (
                <p className="max-w-3xl whitespace-pre-wrap rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-3 text-[12px] leading-6 text-[var(--fg-muted)]">
                  {migration.notes}
                </p>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <DetailTile
                label="Mã chuyển đổi"
                value={migration.id}
                mono
                action={
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void copyMigrationId()}
                    className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold"
                  >
                    <Copy className="size-3.5" />
                    Sao chép
                  </Button>
                }
              />
              <DetailTile
                label="Mã đăng ký"
                value={migration.subscription_id}
                mono
                action={
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void copyValue(migration.subscription_id, "Đã sao chép mã đăng ký")}
                    className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold"
                  >
                    <Copy className="size-3.5" />
                    Sao chép
                  </Button>
                }
              />
              <DetailTile
                label="Mã khách hàng"
                value={migration.customer_id}
                mono
                action={
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void copyValue(migration.customer_id, "Đã sao chép mã khách hàng")}
                    className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold"
                  >
                    <Copy className="size-3.5" />
                    Sao chép
                  </Button>
                }
              />
              <DetailTile
                label="Tạo lúc"
                value={formatDateTime(migration.created_at)}
                action={
                  <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-soft)] bg-white px-3 py-1.5 text-[11px] font-bold text-[var(--fg-muted)]">
                    <CalendarClock className="size-3.5" />
                    Gốc
                  </span>
                }
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 xl:w-[260px] xl:flex-col xl:justify-start">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push(`/customers/${migration.customer_id}`)}
              className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-[11px] font-bold"
            >
              Xem khách hàng
              <ExternalLink className="size-4" />
            </Button>
            {sourceAccountId ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push(`/premium/accounts/${sourceAccountId}`)}
                className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-[11px] font-bold"
              >
                Xem kho nguồn
                <ExternalLink className="size-4" />
              </Button>
            ) : null}
            {targetAccountId ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push(`/premium/accounts/${targetAccountId}`)}
                className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-[11px] font-bold"
              >
                Xem kho đích
                <ExternalLink className="size-4" />
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Tổng bước"
            value={stepSummary.total}
            note={`${stepSummary.completed} hoàn tất · ${stepSummary.in_progress} đang xử lý · ${stepSummary.failed} thất bại`}
          />
          <StatTile
            label="Trạng thái"
            value={getMigrationStatusLabel(migration)}
            note={terminalReasonLabel ? `Lý do kết thúc: ${terminalReasonLabel}` : "Chưa có lý do kết thúc"}
          />
          <StatTile
            label="Bắt đầu"
            value={formatDateTime(startedAt)}
            note={migration.status === "pending" ? "Đang chờ khởi chạy" : "Đã vào quy trình chuyển đổi"}
          />
          <StatTile
            label="Hoàn tất"
            value={formatDateTime(completedAt)}
            note={migration.status === "completed" ? "Đã hoàn tất chuyển đổi" : "Chưa hoàn tất chuyển đổi"}
          />
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          eyebrow="Kho nguồn / kho đích"
          title="Kho nguồn và kho đích"
          description="Thông tin hai đầu chuyển đổi được hiển thị theo cùng một cấu trúc để kiểm tra nhanh."
          className="h-full bg-[var(--surface-light)]"
        >
          <div className="space-y-3">
            <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Kho nguồn</p>
                  <p className="mt-1 truncate text-[14px] font-black text-[var(--fg-base)]">
                    {migration.source_account_email ?? migration.source_account?.primary_email ?? "N/A"}
                  </p>
                  <p className="mt-2 text-[12px] text-[var(--fg-muted)]">
                    {sourceAccountSummary?.sublabel ?? "Chưa có thông tin chi tiết"}
                  </p>
                </div>
                {sourceAccountId ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => router.push(`/premium/accounts/${sourceAccountId}`)}
                    className="inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold"
                  >
                    <ExternalLink className="size-3.5" />
                    Mở
                  </Button>
                ) : null}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <DetailTile
                  label="Sức chứa"
                  value={`${migration.source_account?.used_slots ?? 0}/${migration.source_account?.total_slots ?? 0}`}
                />
                <DetailTile label="Còn trống" value={sourceAvailableSlots} />
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Kho đích</p>
                  <p className="mt-1 truncate text-[14px] font-black text-[var(--fg-base)]">
                    {selectedTargetAccount?.primary_email ?? migration.target_account_email ?? "N/A"}
                  </p>
                  <p className="mt-2 text-[12px] text-[var(--fg-muted)]">
                    {targetAccountSummary?.sublabel ?? "Chưa có thông tin chi tiết"}
                  </p>
                </div>
                {targetAccountId ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => router.push(`/premium/accounts/${targetAccountId}`)}
                    className="inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold"
                  >
                    <ExternalLink className="size-3.5" />
                    Mở
                  </Button>
                ) : null}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <DetailTile
                  label="Sức chứa"
                  value={`${selectedTargetAccount?.used_slots ?? 0}/${selectedTargetAccount?.total_slots ?? 0}`}
                />
                <DetailTile label="Còn trống" value={selectedTargetAvailableSlots} />
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Yêu cầu"
          title="Dữ liệu yêu cầu chuyển đổi"
          description="Chỉ khi chưa bắt đầu chuyển đổi mới có thể chỉnh kho đích, lý do và ghi chú."
          className="h-full"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[12px] text-[var(--fg-muted)]">
              {migration.status !== "pending"
                ? "Yêu cầu đã khóa vì quá trình chuyển đổi không còn ở trạng thái chờ."
                : "Có thể đổi kho đích trước khi bắt đầu chuyển đổi."}
            </p>
            <Button
              type="button"
              variant="secondary"
              disabled={migration.status !== "pending"}
              isLoading={mutationAction === "metadata"}
              onClick={() => void handleSaveMetadata()}
              className="rounded-full px-3 py-2 text-[11px] font-bold"
            >
              <Save className="size-4" />
              Lưu yêu cầu
            </Button>
          </div>

          <div className="mt-4 grid gap-3">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Kho đích dự kiến</label>
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
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Lý do chuyển đổi</label>
              <textarea
                value={metadataForm.reason}
                disabled={migration.status !== "pending"}
                onChange={(event) => setMetadataForm((current) => ({ ...current, reason: event.target.value }))}
                className="min-h-[96px] w-full rounded-ios-sm border border-[var(--border-soft)] bg-white px-3 py-2.5 text-[13px] font-medium text-[var(--fg-base)] outline-none transition-colors placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Ghi chú vận hành</label>
              <textarea
                value={metadataForm.notes}
                disabled={migration.status !== "pending"}
                onChange={(event) => setMetadataForm((current) => ({ ...current, notes: event.target.value }))}
                className="min-h-[88px] w-full rounded-ios-sm border border-[var(--border-soft)] bg-white px-3 py-2.5 text-[13px] font-medium text-[var(--fg-base)] outline-none transition-colors placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        eyebrow="Thực thi"
        title="Điều khiển quá trình chuyển đổi"
        description="Chọn người nhận hiện có, tạo người nhận mới hoặc kết thúc bằng thất bại / huỷ khi có thay đổi."
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-light)] px-3 py-1 text-[11px] font-bold text-[var(--fg-base)]">
            {canMutateLifecycle ? "Có thể thực hiện" : "Chỉ xem"}
          </span>
          <p className="text-[12px] text-[var(--fg-muted)]">
            {isLoadingTargetUsers ? "Đang tải danh sách người nhận..." : `${activeTargetUsers.length} người nhận khả dụng`}
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <DetailTile label="Kho đích đã chọn" value={selectedTargetAccount?.primary_email ?? "Chưa có"} className="bg-white" />
          <DetailTile label="Cần người nhận" value={requiresTargetUser ? "Bắt buộc" : "Không bắt buộc"} className="bg-white" />
        </div>

        <div className="mt-4 grid gap-3">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Người nhận hiện có</label>
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
              <option value="">Không chọn người nhận có sẵn</option>
              {activeTargetUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.user_email}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Hoặc tạo người nhận mới</label>
            <Input
              value={executionForm.createTargetUserEmail}
              disabled={!canMutateLifecycle || Boolean(executionForm.targetUserId)}
              placeholder="nguoi-nhan@example.com"
              onChange={(event) =>
                setExecutionForm((current) => ({ ...current, createTargetUserEmail: event.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Lý do nếu thất bại</label>
            <textarea
              value={executionForm.failureReason}
              disabled={!canMutateLifecycle}
              onChange={(event) => setExecutionForm((current) => ({ ...current, failureReason: event.target.value }))}
              placeholder="Bắt buộc khi quá trình chuyển đổi không hoàn tất."
              className="min-h-[88px] w-full rounded-ios-sm border border-[var(--border-soft)] bg-[var(--surface-light)] px-3 py-2.5 text-[13px] font-medium text-[var(--fg-base)] outline-none transition-colors placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={migration.status !== "pending"}
              isLoading={mutationAction === "start"}
              onClick={() => void patchMigration("start", { action: "start" }, "Đã bắt đầu chuyển đổi")}
            >
              <Play className="size-4" />
              Bắt đầu
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={!canMutateLifecycle}
              isLoading={mutationAction === "complete"}
              onClick={() => void handleComplete()}
            >
              <CheckCircle2 className="size-4" />
              Hoàn tất
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={!canMutateLifecycle}
              isLoading={mutationAction === "fail"}
              onClick={() => void handleFail()}
            >
              <ShieldAlert className="size-4" />
              Đánh dấu thất bại
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!canMutateLifecycle}
              isLoading={mutationAction === "cancel"}
              onClick={() => void patchMigration("cancel", { action: "cancel" }, "Đã huỷ chuyển đổi theo yêu cầu quản trị viên")}
            >
              <XCircle className="size-4" />
              Huỷ
            </Button>
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <SectionCard
          eyebrow={copy.detail.timeline.eyebrow}
        title={copy.detail.timeline.title}
        description={copy.detail.timeline.description}
          className="h-full"
        >
          <div className="space-y-3">
            {migration.steps.length === 0 ? (
              <p className="text-[13px] text-[var(--fg-muted)]">{copy.detail.timeline.empty}</p>
            ) : (
              migration.steps.map((step) => (
                <article
                  key={`${step.step_number}-${step.step_name}`}
                  className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)] p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-[var(--border-soft)] bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[var(--fg-muted)]">
                          {copy.detail.timeline.stepPrefix} {step.step_number}
                        </span>
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${getStepStatusClass(step.step_status)}`}
                        >
                          {getMigrationStepStatusLabel(step.step_status)}
                        </span>
                      </div>
                      <p className="mt-2 text-[15px] font-bold text-[var(--fg-base)]">
                        {getMigrationStepLabel(step.step_name)}
                      </p>
                      <p className="mt-1 text-[12px] text-[var(--fg-muted)]">
                        {formatDateTime(step.started_at)} → {formatDateTime(step.completed_at)}
                      </p>
                    </div>
                  </div>

                  {step.error_message ? (
                    <p className="mt-3 rounded-xl border border-[var(--danger)]/20 bg-[var(--danger)]/5 px-3 py-2 text-[12px] font-medium text-[var(--danger)]">
                      {step.error_message}
                    </p>
                  ) : null}

                  <details className="mt-3 overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-white">
                    <summary className="cursor-pointer px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                      {copy.detail.timeline.viewPayload}
                    </summary>
                    <pre className="custom-scrollbar max-h-48 overflow-auto border-t border-[var(--border-soft)] bg-white p-4 text-[11px] leading-5 text-[var(--fg-base)]">
                      {jsonPreview(step.details)}
                    </pre>
                  </details>
                </article>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Dữ liệu"
          title="Trường nghiệp vụ đã chuẩn hoá"
          description="Dữ liệu này dùng cho đối soát nhanh. JSON gốc được giữ ở phần mở rộng bên dưới."
          className="h-full bg-[var(--surface-light)]"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {businessFacts.map((fact) => (
              <DetailTile key={fact.label} label={fact.label} value={fact.value} className="bg-white" />
            ))}
          </div>

          <details className="mt-4 overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-white">
            <summary className="cursor-pointer px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
              Xem JSON kỹ thuật
            </summary>
            <pre className="custom-scrollbar max-h-64 overflow-auto border-t border-[var(--border-soft)] bg-white p-4 text-[11px] leading-5 text-[var(--fg-base)]">
              {jsonPreview(migration.details)}
            </pre>
          </details>
        </SectionCard>
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
      <Modal isOpen={detailLoading || Boolean(detailMigration)} onClose={onCloseDetail} title={copy.detail.modalTitle} size="4xl">
        {detailLoading ? (
          <div className="flex min-h-56 items-center justify-center">
            <Loader2 className="size-8 animate-spin text-[var(--accent)]" />
          </div>
        ) : detailMigration ? (
          <MigrationDetailModalV2 migration={detailMigration} accounts={accounts} onChanged={onDetailChanged} />
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
