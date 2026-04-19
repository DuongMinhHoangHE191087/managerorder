"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { appToast } from "@/shared/ui/app-toast";

import { Modal } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import type { LicenseKey } from "@/lib/domain/types";

/* ─── CREATE LICENSE KEY MODAL ─────────────────────────────────────────── */
interface CreateLicenseKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: { id: string; name: string }[];
  onSubmit: (body: { keyCode: string; productId: string; status: "available" | "reserved" | "used" | "expired" | "invalid" }) => Promise<void>;
}

export function CreateLicenseKeyModal({ isOpen, onClose, products, onSubmit }: CreateLicenseKeyModalProps) {
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = {
      keyCode: fd.get("keyCode") as string,
      productId: fd.get("productId") as string,
      status: "available" as const,
    };
    try {
      await onSubmit(body);
      onClose();
      appToast.success("Tạo License Key thành công!");
    } catch {
      appToast.error("Lỗi tạo License Key");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Thêm License Key Mới" size="md"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Hủy</Button>
          <Button variant="primary" type="submit" form="create-key-form">Tạo Key</Button>
        </div>
      }
    >
      <form id="create-key-form" onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-[11px] font-bold text-[var(--fg-muted)] mb-2 uppercase tracking-widest">Key Code *</label>
          <Input name="keyCode" placeholder="VD: XXXXX-XXXXX-XXXXX-XXXXX" required />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-[var(--fg-muted)] mb-2 uppercase tracking-widest">Sản phẩm *</label>
          <Select name="productId" required>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </div>
      </form>
    </Modal>
  );
}

/* ─── DELETE LICENSE KEY MODAL ──────────────────────────────────────────── */
interface DeleteLicenseKeyModalProps {
  licenseKey: LicenseKey | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function DeleteLicenseKeyModal({ licenseKey, onClose, onConfirm }: DeleteLicenseKeyModalProps) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onClose();
      appToast.success("Đã xóa License Key!");
    } catch {
      appToast.error("Lỗi xóa License Key");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={!!licenseKey} onClose={onClose} title="Xác nhận xóa License Key" size="sm"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Hủy</Button>
          <Button variant="primary" onClick={handleDelete} disabled={loading} className="!bg-[var(--danger)] hover:!bg-[var(--danger)] !shadow-none">
            {loading ? "Đang xóa..." : "Xóa vĩnh viễn"}
          </Button>
        </div>
      }
    >
      <div className="text-center py-4">
        <div className="size-16 bg-[var(--danger)]/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Trash2 className="size-8 text-[var(--danger)]" />
        </div>
        <p className="text-[15px] font-bold text-[var(--fg-base)] mb-2">Bạn chắc chắn muốn xóa?</p>
        <p className="text-[13px] text-[var(--fg-muted)]">
          License Key <span className="font-bold text-[var(--fg-base)]">&ldquo;{licenseKey?.keyCode}&rdquo;</span> sẽ bị xóa vĩnh viễn.
        </p>
      </div>
    </Modal>
  );
}
