"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";

import { appToast } from "@/shared/ui/app-toast";
import { CreateActionFooter, CreateFlowDialog, CreateFormSection } from "@/shared/ui/create-flow-shell";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import type { LicenseKey } from "@/lib/domain/types";
import { INVENTORY_COPY as copy } from "../copy";

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
    if (!isOpen) return;
    setKeyCode("");
    setProductId((current) => current || defaultProductId);
    setIsSaving(false);
  }, [defaultProductId, isOpen]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedKeyCode = keyCode.trim();
    if (!trimmedKeyCode) {
      appToast.error(copy.createLicenseKey.modal.keyRequired);
      return;
    }

    if (!productId) {
      appToast.error(copy.createLicenseKey.modal.productRequired);
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
      appToast.success(copy.createLicenseKey.modal.success);
    } catch {
      appToast.error(copy.createLicenseKey.modal.error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <CreateFlowDialog
      isOpen={isOpen}
      onClose={onClose}
      title={copy.createLicenseKey.modal.title}
      description={copy.createLicenseKey.modal.description}
      size="md"
      footer={
        <CreateActionFooter
          primaryLabel={copy.createLicenseKey.modal.save}
          pending={isSaving}
          onPrimary={() => {
            const form = document.getElementById("create-key-form") as HTMLFormElement | null;
            form?.requestSubmit();
          }}
          onCancel={onClose}
          cancelLabel={copy.createLicenseKey.modal.cancel}
          disabled={!keyCode.trim() || !productId}
        />
      }
    >
      <form id="create-key-form" onSubmit={handleSubmit} className="grid gap-5">
        <CreateFormSection title={copy.createLicenseKey.main.title} description={copy.createLicenseKey.main.description}>
          <div className="grid gap-4">
            <div className="space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                {copy.createLicenseKey.main.keyLabel}
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
                {copy.createLicenseKey.main.productLabel}
              </label>
              <Select name="productId" value={productId} onChange={(event) => setProductId(event.target.value)} required>
                <option value="" disabled>
                  {copy.createLicenseKey.main.productPlaceholder}
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
      appToast.success(copy.createLicenseKey.delete.success);
    } catch {
      appToast.error(copy.createLicenseKey.delete.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <CreateFlowDialog
      isOpen={!!licenseKey}
      onClose={onClose}
      title={copy.createLicenseKey.delete.title}
      description={copy.createLicenseKey.delete.description}
      size="md"
      footer={
        <CreateActionFooter
          primaryLabel={copy.createLicenseKey.delete.save}
          onPrimary={handleDelete}
          onCancel={onClose}
          cancelLabel={copy.createLicenseKey.delete.cancel}
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
          <p className="text-[15px] font-bold text-[var(--fg-base)]">{copy.createLicenseKey.delete.question}</p>
          <p className="text-[13px] leading-6 text-[var(--fg-muted)]">
            {copy.createLicenseKey.delete.body(licenseKey?.keyCode)}
          </p>
        </div>
      </div>
    </CreateFlowDialog>
  );
}
