"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { appToast } from "@/shared/ui/app-toast";
import { Modal } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { ChoiceCard, ChoiceGrid, FieldLabel, FormSection } from "@/shared/ui/form-primitives";
import type { ProductService } from "@/lib/domain/types";
import { useCreateProduct } from "@/widgets/pages/products/hooks/use-products";
import { PRODUCT_MODE_OPTIONS, MarginPreview } from "./product-shared";

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
  }, [initialName, isOpen]);

  function handleClose() {
    setName(initialName);
    setMode("slot");
    setDurationValue(1);
    setDurationType("months");
    setBuyPrice("");
    setSellPrice("");
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
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Tạo sản phẩm mới"
      size="md"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button type="button" variant="secondary" onClick={handleClose} className="w-full sm:w-auto">
            Hủy
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSave}
            disabled={saving || !name.trim() || !sellPrice}
            className="w-full sm:w-auto"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? "Đang lưu..." : "Tạo sản phẩm"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <FormSection
          title="Thông tin chính"
          description="Định danh sản phẩm và kiểu vận hành."
        >
          <div className="space-y-3">
            <FieldLabel required>Tên sản phẩm</FieldLabel>
            <Input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="VD: Netflix Premium 1 Năm"
            />
          </div>

          <div className="space-y-3">
            <FieldLabel>Loại sản phẩm</FieldLabel>
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <FieldLabel>Thời hạn</FieldLabel>
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
              <FieldLabel>Biên lợi nhuận</FieldLabel>
              <MarginPreview buyPrice={buyPrice} sellPrice={sellPrice} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <FieldLabel>Giá nhập (VNĐ)</FieldLabel>
              <Input
                value={buyPrice}
                onChange={(event) => setBuyPrice(event.target.value)}
                placeholder="0"
                type="number"
                min={0}
                className="font-mono"
              />
            </div>
            <div className="space-y-3">
              <FieldLabel required>Giá bán (VNĐ)</FieldLabel>
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
        </FormSection>
      </div>
    </Modal>
  );
}
