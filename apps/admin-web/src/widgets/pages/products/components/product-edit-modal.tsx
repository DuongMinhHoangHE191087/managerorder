"use client";

import { useEffect, useState } from "react";
import { appToast } from "@/shared/ui/app-toast";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { ChoiceCard, ChoiceGrid, FieldLabel } from "@/shared/ui/form-primitives";
import {
  AdvancedOptionsDisclosure,
  CreateActionFooter,
  CreateFlowDialog,
  CreateFormSection,
} from "@/shared/ui/create-flow-shell";
import type { ProductService } from "@/lib/domain/types";
import { useUpdateProduct } from "@/widgets/pages/products/hooks/use-products";
import { PRODUCT_MODE_OPTIONS, MarginPreview } from "./product-shared";
import { ImageUploader } from "@/shared/ui/image-uploader";

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
  const [iconUrl, setIconUrl] = useState(product.iconUrl ?? "");

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
    setIconUrl(product.iconUrl ?? "");
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
        iconUrl: iconUrl.trim() || undefined,
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
    <CreateFlowDialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Cập nhật sản phẩm"
      description="Giữ cùng nhịp với form tạo mới để sửa giá, thời hạn và trạng thái sản phẩm mà không phải đổi cách nhập liệu."
      size="lg"
      footer={
        <CreateActionFooter
          primaryLabel="Lưu thay đổi"
          onPrimary={() => void handleSave()}
          onCancel={handleClose}
          pending={saving}
          disabled={!name.trim() || !sellPrice}
        />
      }
    >
      <CreateFormSection
        title="Thông tin chính"
        description="Giữ form sửa gọn và đủ sâu để cập nhật nhanh giá, mode vận hành và thời hạn."
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(240px,0.8fr)]">
          <div className="space-y-3">
            <FieldLabel required>Tên sản phẩm</FieldLabel>
            <Input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <div className="pt-2">
              <FieldLabel>Icon sản phẩm</FieldLabel>
              <div className="mt-1">
                <ImageUploader
                  value={iconUrl}
                  onChange={(url) => setIconUrl(url || "")}
                  placeholderType="icon"
                />
              </div>
            </div>
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
      </CreateFormSection>

      <AdvancedOptionsDisclosure title="Thời hạn, giá nhập & biên lợi nhuận">
        <div className="grid gap-4 lg:grid-cols-2">
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
            <FieldLabel>Giá nhập (VNĐ)</FieldLabel>
            <Input
              type="number"
              min={0}
              value={buyPrice}
              onChange={(event) => setBuyPrice(event.target.value)}
              className="font-mono"
            />
          </div>
        </div>

        <div className="space-y-3">
          <FieldLabel>Biên lợi nhuận</FieldLabel>
          <MarginPreview buyPrice={buyPrice} sellPrice={sellPrice} />
        </div>
      </AdvancedOptionsDisclosure>
    </CreateFlowDialog>
  );
}
