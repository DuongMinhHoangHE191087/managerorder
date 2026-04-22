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
import { useUpdateProduct } from "@/widgets/pages/products/hooks/use-products";
import { PRODUCT_MODE_OPTIONS, MarginPreview } from "./product-shared";

interface ProductEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (product: ProductService) => void;
  product: ProductService;
}

export function ProductEditModal({
  isOpen,
  onClose,
  onSuccess,
  product,
}: ProductEditModalProps) {
  const [name, setName] = useState(product.name);
  const [mode, setMode] = useState<"slot" | "key" | "hybrid">(product.mode);
  const [durationValue, setDurationValue] = useState(product.durationValue);
  const [durationType, setDurationType] = useState<"days" | "months" | "years">(product.durationType);
  const [buyPrice, setBuyPrice] = useState(product.buyPriceVnd.toString());
  const [sellPrice, setSellPrice] = useState(product.sellPriceVnd.toString());
  const [isActive, setIsActive] = useState(product.isActive);
  const [saving, setSaving] = useState(false);

  const { mutateAsync: updateProduct } = useUpdateProduct();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setName(product.name);
    setMode(product.mode);
    setDurationValue(product.durationValue);
    setDurationType(product.durationType);
    setBuyPrice(product.buyPriceVnd.toString());
    setSellPrice(product.sellPriceVnd.toString());
    setIsActive(product.isActive);
  }, [isOpen, product]);

  function handleClose() {
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
      const updatedProduct = await updateProduct({
        id: product.id,
        name: trimmedName,
        mode,
        durationValue: Number(durationValue) || 1,
        durationType,
        buyPriceVnd: Number(buyPrice) || 0,
        sellPriceVnd: Number(sellPrice),
        isActive,
      });

      appToast.success(`Đã cập nhật sản phẩm "${updatedProduct?.name ?? trimmedName}"!`);
      onSuccess(updatedProduct as ProductService);
      handleClose();
    } catch (error: unknown) {
      appToast.error(error instanceof Error ? error.message : "Lỗi cập nhật");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Cập nhật sản phẩm"
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
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <FormSection
          title="Thông tin chính"
          description="Điều chỉnh tên, loại và cấu hình giá."
        >
          <div className="space-y-3">
            <FieldLabel required>Tên sản phẩm</FieldLabel>
            <Input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
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
                  type="number"
                  min={1}
                  value={durationValue}
                  onChange={(event) => setDurationValue(Number(event.target.value))}
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
                type="number"
                min={0}
                value={buyPrice}
                onChange={(event) => setBuyPrice(event.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-3">
              <FieldLabel required>Giá bán (VNĐ)</FieldLabel>
              <Input
                type="number"
                min={0}
                value={sellPrice}
                onChange={(event) => setSellPrice(event.target.value)}
                className="font-mono"
              />
            </div>
          </div>

          <div className="space-y-3">
            <FieldLabel>Trạng thái</FieldLabel>
            <ChoiceGrid className="grid-cols-1 sm:grid-cols-2">
              <ChoiceCard
                selected={isActive}
                title="Đang bán"
                description="Hiển thị trên luồng bán hàng"
                onClick={() => setIsActive(true)}
              />
              <ChoiceCard
                selected={!isActive}
                title="Ngừng bán"
                description="Ẩn khỏi lựa chọn mới"
                onClick={() => setIsActive(false)}
              />
            </ChoiceGrid>
          </div>
        </FormSection>
      </div>
    </Modal>
  );
}
