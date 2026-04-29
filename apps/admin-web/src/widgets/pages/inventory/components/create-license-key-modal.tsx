"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";

import { appToast } from "@/shared/ui/app-toast";
import { CreateActionFooter, CreateFlowDialog, CreateFormSection } from "@/shared/ui/create-flow-shell";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import type { LicenseKey } from "@/lib/domain/types";

interface CreateLicenseKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: { id: string; name: string }[];
  onSubmit: (body: {
    keyCode: string;
    productId: string;
    status: "available" | "reserved" | "used" | "expired" | "invalid";
  }) => Promise<void>;
}

export function CreateLicenseKeyModal({ isOpen, onClose, products, onSubmit }: CreateLicenseKeyModalProps) {
  const [keyCode, setKeyCode] = useState("");
  const [productId, setProductId] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const defaultProductId = useMemo(() => products[0]?.id ?? "", [products]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setKeyCode("");
    setProductId((current) => current || defaultProductId);
    setIsSaving(false);
  }, [defaultProductId, isOpen]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedKeyCode = keyCode.trim();
    if (!trimmedKeyCode) {
      appToast.error("Vui lòng nhập mã License Key.");
      return;
    }

    if (!productId) {
      appToast.error("Vui lòng chọn sản phẩm.");
      return;
    }

    setIsSaving(true);
    try {
      await onSubmit({
        keyCode: trimmedKeyCode,
        productId,
        status: "available",
      });
      onClose();
      appToast.success("Tạo License Key thành công.");
    } catch {
      appToast.error("Không thể tạo License Key.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <CreateFlowDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Thêm License Key mới"
      description="Nhập mã key và gắn vào sản phẩm tương ứng. Các trường còn lại sẽ được hệ thống khởi tạo tự động."
      size="md"
      footer={
        <CreateActionFooter
          primaryLabel="Tạo key"
          pending={isSaving}
          onPrimary={() => {
            const form = document.getElementById("create-key-form") as HTMLFormElement | null;
            form?.requestSubmit();
          }}
          onCancel={onClose}
          cancelLabel="Hủy"
          disabled={!keyCode.trim() || !productId}
        />
      }
    >
      <form id="create-key-form" onSubmit={handleSubmit} className="grid gap-5">
        <CreateFormSection
          title="Thông tin chính"
          description="Giữ form gọn để nhập nhanh, tránh làm người dùng phải đi qua nhiều lớp cấu hình không cần thiết."
        >
          <div className="grid gap-4">
            <div className="space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                Mã License Key
              </label>
              <Input
                autoFocus
                name="keyCode"
                value={keyCode}
                onChange={(event) => setKeyCode(event.target.value)}
                placeholder="VD: XXXXX-XXXXX-XXXXX-XXXXX"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                Sản phẩm
              </label>
              <Select
                name="productId"
                value={productId}
                onChange={(event) => setProductId(event.target.value)}
                required
              >
                <option value="" disabled>
                  Chọn sản phẩm
                </option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </CreateFormSection>
      </form>
    </CreateFlowDialog>
  );
}

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
      appToast.success("Đã xóa License Key.");
    } catch {
      appToast.error("Không thể xóa License Key.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <CreateFlowDialog
      isOpen={!!licenseKey}
      onClose={onClose}
      title="Xác nhận xóa License Key"
      description="Thao tác này không thể hoàn tác. Key sẽ bị gỡ khỏi hệ thống ngay sau khi xác nhận."
      size="md"
      footer={
        <CreateActionFooter
          primaryLabel="Xóa vĩnh viễn"
          onPrimary={handleDelete}
          onCancel={onClose}
          cancelLabel="Hủy"
          pending={loading}
          disabled={loading}
        />
      }
    >
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-[var(--danger)]/10">
          <Trash2 className="size-8 text-[var(--danger)]" />
        </div>
        <div className="space-y-1">
          <p className="text-[15px] font-bold text-[var(--fg-base)]">Bạn chắc chắn muốn xóa?</p>
          <p className="text-[13px] leading-6 text-[var(--fg-muted)]">
            License Key <span className="font-bold text-[var(--fg-base)]">&ldquo;{licenseKey?.keyCode}&rdquo;</span>{" "}
            sẽ bị xóa vĩnh viễn khỏi kho.
          </p>
        </div>
      </div>
    </CreateFlowDialog>
  );
}
