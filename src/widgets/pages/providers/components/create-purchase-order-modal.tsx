"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  Calendar,
  ChevronDown,
  CreditCard,
  ImagePlus,
  Package,
  Plus,
  Search,
  StickyNote,
  Trash2,
  Upload,
  Warehouse,
  X,
} from "lucide-react";
import { useProducts } from "@/widgets/pages/products/hooks/use-products";
import {
  useCreateSourceAccount,
  useSourceAccounts,
} from "@/widgets/pages/inventory/hooks/use-source-accounts";
import { SourceAccountCombobox } from "@/widgets/pages/orders/components/create-form/comboboxes";
import {
  useCreatePurchaseOrder,
} from "@/widgets/pages/providers/hooks/use-provider-detail";
import { useProviders } from "@/widgets/pages/providers/hooks/use-providers";
import { appToast } from "@/shared/ui/app-toast";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Modal } from "@/shared/ui/modal";
import { Select } from "@/shared/ui/select";
import { SmartSelector } from "@/shared/ui/smart-selector";
import { formatDateLabel, formatMoney } from "@/lib/utils";

const ProductCreateModalLazy = dynamic(
  () =>
    import("@/widgets/pages/products/components/product-create-modal").then((mod) => ({
      default: mod.ProductCreateModal,
    })),
  { ssr: false }
);

const CreateSourceAccountModalLazy = dynamic(
  () =>
    import("@/widgets/pages/inventory/components/create-source-account-modal").then((mod) => ({
      default: mod.CreateSourceAccountModal,
    })),
  { ssr: false }
);

interface PurchaseOrderDraftItem {
  productId: string;
  productName: string;
  quantity: number;
  priceVnd: number;
}

interface CreatePurchaseOrderModalProps {
  providerId: string;
  isOpen: boolean;
  onClose: () => void;
}

function createEmptyItem(): PurchaseOrderDraftItem {
  return {
    productId: "",
    productName: "",
    quantity: 1,
    priceVnd: 0,
  };
}

export function CreatePurchaseOrderModal({
  providerId,
  isOpen,
  onClose,
}: CreatePurchaseOrderModalProps) {
  const createPOMutation = useCreatePurchaseOrder(providerId);
  const { mutateAsync: createSourceAccount } = useCreateSourceAccount();
  const { data: allProducts = [] } = useProducts();
  const { data: allProviders = [] } = useProviders();
  const { data: allSourceAccounts = [] } = useSourceAccounts();

  const [poItems, setPOItems] = useState<PurchaseOrderDraftItem[]>([createEmptyItem()]);
  const [poNotes, setPONotes] = useState("");
  const [poPaymentMethod, setPOPaymentMethod] = useState("bank_transfer");
  const [poImportDate, setPOImportDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );
  const [poProofImages, setPOProofImages] = useState<string[]>([]);
  const [showProductCreateModal, setShowProductCreateModal] = useState(false);
  const [productCreateIdx, setProductCreateIdx] = useState(0);
  const [connectToInventory, setConnectToInventory] = useState(false);
  const [selectedSourceAccountId, setSelectedSourceAccountId] = useState("");
  const [showCreateAccountModal, setShowCreateAccountModal] = useState(false);

  const totalAmount = useMemo(
    () => poItems.reduce((sum, item) => sum + item.quantity * item.priceVnd, 0),
    [poItems],
  );

  const productMap = useMemo(
    () => new Map(allProducts.map((product) => [product.id, product.name])),
    [allProducts],
  );

  const selectedProductIds = useMemo(
    () => poItems.filter((item) => item.productId).map((item) => item.productId),
    [poItems],
  );

  const selectedAccount = useMemo(
    () => allSourceAccounts.find((account) => account.id === selectedSourceAccountId) ?? null,
    [allSourceAccounts, selectedSourceAccountId],
  );

  function updateItem(
    index: number,
    updater: (item: PurchaseOrderDraftItem) => PurchaseOrderDraftItem,
  ) {
    setPOItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? updater(item) : item,
      ),
    );
  }

  function addItem() {
    setPOItems((current) => [...current, createEmptyItem()]);
  }

  function removeItem(index: number) {
    setPOItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function handleCreatePO() {
    const validItems = poItems.filter(
      (item) => (item.productId || item.productName) && item.quantity > 0,
    );
    if (validItems.length === 0) {
      appToast.error("Thêm ít nhất 1 sản phẩm hợp lệ");
      return;
    }

    try {
      const notes: Record<string, unknown> = {};
      if (poNotes) {
        notes.text = poNotes;
      }
      if (poProofImages.length > 0) {
        notes.proof_images = poProofImages;
      }

      await createPOMutation.mutateAsync({
        items: validItems.map((item) => ({
          productId: item.productId || crypto.randomUUID(),
          product_id: item.productId || undefined,
          productName: item.productName,
          quantity: item.quantity,
          priceVnd: item.priceVnd,
          unit_price_vnd: item.priceVnd,
        })),
        totalAmountVnd: validItems.reduce(
          (sum, item) => sum + item.quantity * item.priceVnd,
          0,
        ),
        paymentMethod: poPaymentMethod,
        notes: Object.keys(notes).length > 0 ? JSON.stringify(notes) : undefined,
        importDate: poImportDate || undefined,
      });

      if (connectToInventory && selectedSourceAccountId) {
        appToast.success("Đã kết nối đơn nhập với tài khoản kho");
      }
      appToast.success("Tạo đơn nhập hàng thành công");
      onClose();
    } catch {
      appToast.error("Lỗi tạo đơn nhập hàng");
    }
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Tạo đơn nhập hàng"
        size="2xl"
        footer={
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)] px-4 py-3">
              <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase">
                Tổng đơn nhập
              </p>
              <p className="text-lg font-black text-[var(--fg-base)]">
                {formatMoney(totalAmount)}
              </p>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
              <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">
                Hủy
              </Button>
              <Button
                variant="primary"
                onClick={handleCreatePO}
                disabled={createPOMutation.isPending}
                className="w-full sm:w-auto"
              >
                <Plus className="size-4" />
                {createPOMutation.isPending ? "Đang tạo..." : "Tạo đơn nhập"}
              </Button>
            </div>
          </div>
        }
      >
        <div className="custom-scrollbar max-h-[65vh] space-y-5 overflow-y-auto pr-1">
          <div className="space-y-3">
            {poItems.map((item, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-surface)] p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="size-6 rounded-lg bg-[var(--accent)] text-white text-[10px] font-black flex items-center justify-center">
                      {idx + 1}
                    </div>
                    <span className="text-[12px] font-bold text-[var(--fg-base)]">
                      Sản phẩm
                    </span>
                  </div>
                  {poItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="text-red-400 hover:text-red-600 cursor-pointer p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>

                <SmartSelector
                  items={allProducts.map((product) => ({
                    id: product.id,
                    label: product.name,
                    sublabel: `Nhập: ${formatMoney(product.buyPriceVnd)} · Bán: ${formatMoney(product.sellPriceVnd)}`,
                  }))}
                  value={item.productId}
                  onSelect={(selected) => {
                    const product = allProducts.find((value) => value.id === selected.id);
                    if (!product) {
                      return;
                    }
                    updateItem(idx, (current) => ({
                      ...current,
                      productId: product.id,
                      productName: product.name,
                      quantity: current.quantity || 1,
                      priceVnd: product.buyPriceVnd,
                    }));
                  }}
                  onCreateNew={() => {
                    setProductCreateIdx(idx);
                    setShowProductCreateModal(true);
                  }}
                  placeholder="Tìm sản phẩm theo tên..."
                  createLabel="Tạo sản phẩm mới"
                />

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                  <div className="sm:col-span-3">
                    <label className="text-[10px] font-bold text-[var(--fg-muted)] uppercase mb-1.5 block">
                      Số lượng
                    </label>
                    <Input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(event) =>
                        updateItem(idx, (current) => ({
                          ...current,
                          quantity: Number(event.target.value) || 1,
                        }))
                      }
                      className="!py-2 text-center font-bold text-[13px]"
                    />
                  </div>
                  <div className="sm:col-span-5">
                    <label className="text-[10px] font-bold text-[var(--fg-muted)] uppercase mb-1.5 block">
                      Đơn giá nhập
                    </label>
                    <Input
                      type="number"
                      value={item.priceVnd || ""}
                      onChange={(event) =>
                        updateItem(idx, (current) => ({
                          ...current,
                          priceVnd: Number(event.target.value) || 0,
                        }))
                      }
                      className="!py-2 font-mono text-[13px]"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <label className="text-[10px] font-bold text-[var(--fg-muted)] uppercase mb-1.5 block">
                      Thành tiền
                    </label>
                    <div className="h-10 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-light)] px-3 flex items-center font-black text-[var(--accent)]">
                      {formatMoney(item.quantity * item.priceVnd)}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-1.5 text-[var(--accent)] text-[12px] font-bold hover:underline cursor-pointer"
            >
              <Plus className="size-3.5" />
              Thêm sản phẩm
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-widest mb-2 block flex items-center gap-1.5">
                <CreditCard className="size-3 text-[var(--accent)]" />
                Thanh toán
              </label>
              <Select
                value={poPaymentMethod}
                onChange={(event) => setPOPaymentMethod(event.target.value)}
                className="h-11 rounded-xl text-[13px] font-bold"
              >
                <option value="bank_transfer">Chuyển khoản</option>
                <option value="cash">Tiền mặt</option>
                <option value="credit">Ghi nợ</option>
              </Select>
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-widest mb-2">
                <Calendar className="size-3 text-blue-500" />
                Ngày nhập
              </label>
              <input
                type="date"
                value={poImportDate}
                onChange={(event) => setPOImportDate(event.target.value)}
                className="w-full rounded-xl border-2 border-[var(--border-soft)] bg-white px-3 py-2.5 text-[13px] font-bold text-[var(--fg-base)]"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <StickyNote className="size-3 text-amber-500" />
                Ghi chú
              </label>
              <Input
                value={poNotes}
                onChange={(event) => setPONotes(event.target.value)}
                placeholder="Ghi chú đơn nhập..."
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-widest mb-2">
              <Upload className="size-3" />
              Minh chứng thanh toán
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {poProofImages.map((image, index) => (
                <div
                  key={`${image}-${index}`}
                  className="relative group w-20 h-20 rounded-lg overflow-hidden border border-[var(--border-soft)]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image}
                    alt={`Proof ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setPOProofImages((current) =>
                        current.filter((_, currentIndex) => currentIndex !== index),
                      )
                    }
                    className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
              <label className="w-20 h-20 rounded-lg border-2 border-dashed border-[var(--border-soft)] hover:border-[var(--accent)] transition-colors flex flex-col items-center justify-center cursor-pointer gap-1">
                <ImagePlus className="size-5 text-[var(--fg-muted)]" />
                <span className="text-[9px] font-bold text-[var(--fg-muted)]">
                  Tải ảnh
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    Array.from(event.target.files || []).forEach((file) => {
                      const reader = new FileReader();
                      reader.onload = () => {
                        if (typeof reader.result === "string") {
                          const imageData = reader.result;
                          setPOProofImages((current) => [...current, imageData]);
                        }
                      };
                      reader.readAsDataURL(file);
                    });
                    event.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>

          <div className="border-t border-[var(--border-soft)]/60 pt-3 space-y-3">
            <button
              type="button"
              onClick={() => {
                setConnectToInventory((current) => !current);
                if (connectToInventory) {
                  setSelectedSourceAccountId("");
                }
              }}
              className={`flex items-center gap-2 text-[12px] font-bold transition-all cursor-pointer rounded-xl px-4 py-2 ${
                connectToInventory
                  ? "bg-[var(--accent)]/10 text-[var(--accent)] border-transparent"
                  : "bg-[var(--surface-light)] border-2 border-[var(--border-soft)] text-[var(--fg-muted)]"
              }`}
            >
              <Warehouse className="size-4" />
              Kết nối kho hàng
              <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider bg-[var(--border-soft)] text-[var(--fg-muted)]">
                {connectToInventory ? "BẬT" : "TẮT"}
              </span>
              <ChevronDown
                className={`size-3.5 ml-auto transition-transform ${
                  connectToInventory ? "rotate-180" : ""
                }`}
              />
            </button>

            {connectToInventory && (
              <div className="space-y-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-light)] p-3">
                {selectedProductIds.length > 0 && (
                  <p className="text-[10px] text-[var(--fg-muted)]">
                    <Search className="size-3 inline-block mr-1" />
                    Đang lọc theo {selectedProductIds.length} sản phẩm đã chọn
                  </p>
                )}

                <SourceAccountCombobox
                  accounts={allSourceAccounts}
                  productIds={selectedProductIds}
                  value={selectedSourceAccountId}
                  onChange={setSelectedSourceAccountId}
                  onCreateNew={() => setShowCreateAccountModal(true)}
                />

                {selectedAccount && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[11px]">
                    <p className="font-bold text-emerald-700">
                      Đã chọn: {selectedAccount.email}
                    </p>
                    <p className="mt-1 text-emerald-600">
                      {selectedAccount.maxSlots - selectedAccount.usedSlots} slot còn trống · HH: {formatDateLabel(selectedAccount.expiresAt)}
                    </p>
                    <p className="mt-1 text-emerald-600/80">
                      SP: {selectedAccount.productIds
                        .map((productId) => productMap.get(productId) || productId)
                        .join(", ")}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-surface)] overflow-hidden">
            <div className="p-3 border-b border-[var(--border-soft)]">
              <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-widest">
                Tổng kết đơn nhập
              </p>
            </div>
            <div className="divide-y divide-[var(--border-soft)]">
              {poItems
                .filter((item) => item.productId || item.productName)
                .map((item, idx) => (
                  <div
                    key={`${item.productId}-${idx}`}
                    className="flex items-center justify-between px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Package className="size-3.5 text-[var(--accent)] shrink-0" />
                      <span className="text-[12px] font-bold text-[var(--fg-base)] truncate">
                        {item.productName || "SP"}
                      </span>
                      <span className="text-[10px] text-[var(--fg-muted)]">
                        x{item.quantity}
                      </span>
                    </div>
                    <span className="text-[12px] font-black text-[var(--fg-base)] shrink-0 ml-2">
                      {formatMoney(item.quantity * item.priceVnd)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </Modal>

      {showCreateAccountModal && (
        <CreateSourceAccountModalLazy
          isOpen={showCreateAccountModal}
          onClose={() => setShowCreateAccountModal(false)}
          providers={allProviders}
          products={allProducts}
          productMap={productMap}
          onSubmit={async (body) => {
            const result = await createSourceAccount(body);
            if (result?.id) {
              setSelectedSourceAccountId(result.id);
            }
            setShowCreateAccountModal(false);
          }}
        />
      )}

      {showProductCreateModal && (
        <ProductCreateModalLazy
          isOpen={showProductCreateModal}
          onClose={() => setShowProductCreateModal(false)}
          onSuccess={(newProduct) => {
            updateItem(productCreateIdx, (current) => ({
              ...current,
              productId: newProduct.id,
              productName: newProduct.name,
              quantity: current.quantity || 1,
              priceVnd: newProduct.buyPriceVnd,
            }));
            setShowProductCreateModal(false);
          }}
        />
      )}
    </>
  );
}
