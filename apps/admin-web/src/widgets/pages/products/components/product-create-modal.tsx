"use client";

import { useEffect, useState } from "react";
import { appToast } from "@/shared/ui/app-toast";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { ChoiceCard, ChoiceGrid } from "@/shared/ui/form-primitives";
import {
  AdvancedOptionsDisclosure,
  CreateActionFooter,
  CreateFlowDialog,
  CreateFormSection,
} from "@/shared/ui/create-flow-shell";
import type { ProductService } from "@/lib/domain/types";
import { useCreateProduct } from "@/widgets/pages/products/hooks/use-products";
import { PRODUCT_MODE_OPTIONS, MarginPreview } from "./product-shared";
import { ImageUploader } from "@/shared/ui/image-uploader";

export type CreateProductResult = ProductService;

interface ProductCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (product: CreateProductResult) => void;
  initialName?: string;
}

export function ProductCreateModal({
  isOpen,
  onClose,
  onSuccess,
  initialName = "",
}: ProductCreateModalProps) {
  const [name, setName] = useState(initialName);
  const [mode, setMode] = useState<"slot" | "key" | "hybrid">("slot");
  const [durationValue, setDurationValue] = useState(1);
  const [durationType, setDurationType] = useState<"days" | "months" | "years">("months");
  const [buyPrice, setBuyPrice] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [iconUrl, setIconUrl] = useState("");

  const { mutateAsync: createProduct } = useCreateProduct();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setName(initialName);
    setMode("slot");
    setDurationValue(1);
    setDurationType("months");
    setBuyPrice("");
    setSellPrice("");
    setIconUrl("");
  }, [initialName, isOpen]);

  function handleClose() {
    setName(initialName);
    setMode("slot");
    setDurationValue(1);
    setDurationType("months");
    setBuyPrice("");
    setSellPrice("");
    setIconUrl("");
    onClose();
  }

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      appToast.error("Vui lòng nhập tên sản phẩm");
      return;
    }
    if (!sellPrice || Number(sellPrice) <= 0) {
      appToast.error("Vui lòng nhập giá bán hợp lệ");
      return;
    }

    setSaving(true);
    try {
      const newProduct = await createProduct({
        name: trimmedName,
        mode,
        durationType,
        durationValue: Number(durationValue) || 1,
        buyPriceVnd: Number(buyPrice) || 0,
        sellPriceVnd: Number(sellPrice),
        iconUrl: iconUrl.trim() || undefined,
      });

      appToast.success(`Đã tạo sản phẩm "${newProduct?.name ?? trimmedName}"!`);
      onSuccess(newProduct as CreateProductResult);
      handleClose();
    } catch (error: unknown) {
      appToast.error(error instanceof Error ? error.message : "Lỗi tạo sản phẩm");
    } finally {
      setSaving(false);
    }
  }

  return (
    <CreateFlowDialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Tạo sản phẩm mới"
      description="Chuẩn hóa nhanh tên, kiểu bán và giá để dùng lại ngay ở orders, providers và premium flows."
      size="lg"
      footer={
        <CreateActionFooter
          primaryLabel="Tạo sản phẩm"
          onPrimary={() => void handleSave()}
          onCancel={handleClose}
          pending={saving}
          disabled={!name.trim() || !sellPrice}
        />
      }
    >
      <CreateFormSection
          title="Thông tin chính"
          description="Giữ phần create gọn: tên, kiểu vận hành và giá bán là đủ để tạo nhanh từ order hoặc purchase flow."
        >
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(240px,0.8fr)]">
            <div className="space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                Tên sản phẩm <span className="text-[var(--danger)]">*</span>
              </label>
            <Input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void handleSave();
                  }
                }}
              placeholder="VD: Netflix Premium 1 Năm"
            />
            <div className="pt-2">
              <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)] mb-1">
                Icon sản phẩm
              </label>
              <ImageUploader
                value={iconUrl}
                onChange={(url) => setIconUrl(url || "")}
                placeholderType="icon"
              />
            </div>
          </div>

            <div className="space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                Giá bán (VNĐ) <span className="text-[var(--danger)]">*</span>
              </label>
              <Input
                value={sellPrice}
                onChange={(event) => setSellPrice(event.target.value)}
                placeholder="0"
                type="number"
                min={0}
                className="font-mono"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
              Loại sản phẩm
            </label>
            <ChoiceGrid className="grid-cols-1 sm:grid-cols-3">
              {PRODUCT_MODE_OPTIONS.map((option) => (
                <ChoiceCard
                  key={option.value}
                  selected={mode === option.value}
                  title={option.label}
                  description={option.desc}
                  onClick={() => setMode(option.value as "slot" | "key" | "hybrid")}
                />
              ))}
            </ChoiceGrid>
          </div>
      </CreateFormSection>

      <AdvancedOptionsDisclosure title="Thời hạn, giá nhập & biên lợi nhuận">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                Thời hạn
              </label>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  value={durationValue}
                  onChange={(event) => setDurationValue(Number(event.target.value))}
                  type="number"
                  min={1}
                  className="col-span-1 font-semibold"
                />
                <Select
                  value={durationType}
                  onChange={(event) => setDurationType(event.target.value as "days" | "months" | "years")}
                  className="col-span-2"
                >
                  <option value="days">Ngày</option>
                  <option value="months">Tháng</option>
                  <option value="years">Năm</option>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                Giá nhập (VNĐ)
              </label>
              <Input
                value={buyPrice}
                onChange={(event) => setBuyPrice(event.target.value)}
                placeholder="0"
                type="number"
                min={0}
                className="font-mono"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
              Biên lợi nhuận
            </label>
            <MarginPreview buyPrice={buyPrice} sellPrice={sellPrice} />
          </div>
      </AdvancedOptionsDisclosure>
    </CreateFlowDialog>
  );
}
