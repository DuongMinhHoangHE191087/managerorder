"use client";

import { useEffect, useMemo, useState } from "react";
import { appToast } from "@/shared/lib/toast";
import { readApiEnvelope } from "@/shared/lib/api-client";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { Modal } from "@/shared/ui/modal";

export interface QuickMigrationSubscription {
  id: string;
  customer_name: string;
  service_type_id: string;
  service_name: string;
  account_email: string;
  premium_account_id: string;
}

export type QuickMigrationAccountRow = {
  id: string;
  primary_email: string;
  service_type_id: string;
  status: string;
  total_slots: number;
  used_slots: number;
};

export interface QuickMigrationModalProps {
  subscription: QuickMigrationSubscription | null;
  onClose: () => void;
  onSubmitted: () => void;
}

export function QuickMigrationModal({ subscription, onClose, onSubmitted }: QuickMigrationModalProps) {
  const [accounts, setAccounts] = useState<QuickMigrationAccountRow[]>([]);
  const [selectedTargetAccountId, setSelectedTargetAccountId] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  useEffect(() => {
    if (!subscription) return;
    setSelectedTargetAccountId("");
    setReason("Family cũ bị quét, lỗi hệ thống.");
    setSaving(false);

    setLoadingAccounts(true);
    fetch("/api/premium/accounts")
      .then((res) => res.json())
      .then((payload) => {
        if (payload?.data) {
          setAccounts(payload.data);
        }
      })
      .catch((err) => console.error("Error loading accounts", err))
      .finally(() => setLoadingAccounts(false));
  }, [subscription]);

  const compatibleAccounts = useMemo(() => {
    if (!subscription) return [];
    return accounts.filter((account) => {
      const isCompatible = account.service_type_id === subscription.service_type_id;
      const isActive = account.status === "active";
      const hasSlots = account.total_slots - account.used_slots > 0;
      const isNotSame = account.id !== subscription.premium_account_id;
      return isCompatible && isActive && hasSlots && isNotSame;
    });
  }, [accounts, subscription]);

  async function handleSubmit() {
    if (!subscription || !selectedTargetAccountId || !reason.trim()) {
      appToast.error("Vui lòng chọn kho đích và nhập lý do di chuyển!");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/premium/migrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription_id: subscription.id,
          target_account_id: selectedTargetAccountId,
          reason: reason.trim(),
        }),
      });
      const payload = await readApiEnvelope(response);

      if (!response.ok) {
        appToast.error(payload.error ?? "Không thể tạo yêu cầu di chuyển");
        return;
      }

      appToast.success("Đã tạo yêu cầu di chuyển Family thành công!");
      onSubmitted();
      onClose();
    } catch (error) {
      console.error("[QuickMigrationModal] handleSubmit", error);
      appToast.error("Lỗi kết nối khi tạo yêu cầu di chuyển");
    } finally {
      setSaving(false);
    }
  }

  if (!subscription) return null;

  return (
    <Modal
      isOpen={!!subscription}
      onClose={onClose}
      title="Chuyển đổi Family nhanh"
      size="md"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Huỷ
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={saving || !selectedTargetAccountId || !reason.trim()}
            className="bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] font-bold text-white shadow-[0_16px_30px_rgba(var(--accent-rgb),0.2)]"
          >
            {saving ? "Đang xử lý..." : "Xác nhận di chuyển"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)] px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--fg-muted)]">Thuê bao nguồn</p>
          <p className="mt-1 text-[13px] font-black text-[var(--fg-base)]">{subscription.customer_name}</p>
          <p className="text-[12px] font-medium text-[var(--fg-muted)] mt-0.5">
            Dịch vụ: {subscription.service_name} | Email hiện tại: {subscription.account_email}
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
            Tài khoản gốc đích (Family còn slot trống)
          </label>
          {loadingAccounts ? (
            <p className="text-[12px] font-semibold text-[var(--fg-muted)]">Đang tải danh sách kho...</p>
          ) : compatibleAccounts.length === 0 ? (
            <p className="text-[12px] font-semibold text-[var(--danger)]">
              Không có tài khoản gốc nào cùng loại dịch vụ còn slot trống hoặc đang hoạt động!
            </p>
          ) : (
            <Select
              value={selectedTargetAccountId}
              onChange={(e) => setSelectedTargetAccountId(e.target.value)}
              className="w-full"
            >
              <option value="">-- Chọn tài khoản gốc đích --</option>
              {compatibleAccounts.map((account) => {
                const slotsRemaining = account.total_slots - account.used_slots;
                return (
                  <option key={account.id} value={account.id}>
                    {account.primary_email} (Còn {slotsRemaining}/{account.total_slots} slot trống)
                  </option>
                );
              })}
            </Select>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
            Lý do di chuyển
          </label>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Nhập lý do di chuyển..."
          />
        </div>
      </div>
    </Modal>
  );
}
