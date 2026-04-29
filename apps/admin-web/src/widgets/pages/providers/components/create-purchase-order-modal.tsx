"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  Calendar,
  ChevronDown,
  CreditCard,
  ImagePlus,
  Plus,
  Search,
  StickyNote,
  Trash2,
  Upload,
  Warehouse,
  X,
} from "lucide-react";

import { useProducts } from "@/widgets/pages/products/hooks/use-products";
import { useCreateSourceAccount, useSourceAccounts } from "@/widgets/pages/inventory/hooks/use-source-accounts";
import { SourceAccountCombobox } from "@/widgets/pages/orders/components/create-form/comboboxes";
import { useCreatePurchaseOrder } from "@/widgets/pages/providers/hooks/use-provider-detail";
import { useProviders } from "@/widgets/pages/providers/hooks/use-providers";
import { vi } from "@/shared/messages/vi";
import { appToast } from "@/shared/ui/app-toast";
import {
  AdvancedOptionsDisclosure,
  CreateFlowDialog,
  CreateFormSection,
} from "@/shared/ui/create-flow-shell";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { SmartSelector } from "@/shared/ui/smart-selector";
import { formatDateLabel, formatMoney } from "@/lib/utils";

const ProductCreateModalLazy = dynamic(
  () =>
    import("@/widgets/pages/products/components/product-create-modal").then((mod) => ({
      default: mod.ProductCreateModal,
    })),
  { ssr: false },
);

const CreateSourceAccountModalLazy = dynamic(
  () =>
    import("@/widgets/pages/inventory/components/create-source-account-modal").then((mod) => ({
      default: mod.CreateSourceAccountModal,
    })),
  { ssr: false },
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
  const text = vi.providers.createPurchaseOrderModal;
  const createPOMutation = useCreatePurchaseOrder(providerId);
  const { mutateAsync: createSourceAccount } = useCreateSourceAccount();
  const { data: allProducts = [] } = useProducts();
  const { data: allProviders = [] } = useProviders();
  const { data: allSourceAccounts = [] } = useSourceAccounts();

  const [poItems, setPOItems] = useState<PurchaseOrderDraftItem[]>([createEmptyItem()]);
  const [poNotes, setPONotes] = useState("");
  const [poPaymentMethod, setPOPaymentMethod] = useState("bank_transfer");
  const [poImportDate, setPOImportDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [poProofImages, setPOProofImages] = useState<string[]>([]);
  const [showProductCreateModal, setShowProductCreateModal] = useState(false);
  const [productCreateIdx, setProductCreateIdx] = useState(0);
  const [connectToInventory, setConnectToInventory] = useState(false);
  const [selectedSourceAccountId, setSelectedSourceAccountId] = useState("");
  const [showCreateAccountModal, setShowCreateAccountModal] = useState(false);
  const [saving, setSaving] = useState(false);

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

  function updateItem(index: number, updater: (item: PurchaseOrderDraftItem) => PurchaseOrderDraftItem) {
    setPOItems((current) => current.map((item, itemIndex) => (itemIndex === index ? updater(item) : item)));
  }

  function addItem() {
    setPOItems((current) => [...current, createEmptyItem()]);
  }

  function removeItem(index: number) {
    setPOItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function handleCreatePO() {
    const validItems = poItems.filter((item) => (item.productId || item.productName) && item.quantity > 0);

    if (validItems.length === 0) {
      appToast.error(text.minProductError);
      return;
    }

    setSaving(true);
    try {
      const notes: Record<string, unknown> = {};
      if (poNotes) {
        notes.text = poNotes;
      }
      if (poImportDate) {
        notes.import_date = poImportDate;
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
        totalAmountVnd: validItems.reduce((sum, item) => sum + item.quantity * item.priceVnd, 0),
        paymentMethod: poPaymentMethod,
        notes: Object.keys(notes).length > 0 ? JSON.stringify(notes) : undefined,
        importDate: poImportDate || undefined,
      });

      if (connectToInventory && selectedSourceAccountId) {
        appToast.success(text.linkedInventorySuccess);
      }
      appToast.success(text.createSuccess);
      onClose();
    } catch {
      appToast.error(text.createError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <CreateFlowDialog
        isOpen={isOpen}
        onClose={onClose}
        title={text.title}
        description="Tạo phiếu nhập rõ ràng hơn với ba lớp: sản phẩm, thanh toán và tùy chọn nâng cao."
        size="2xl"
        footer={
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)] px-4 py-3">
              <p className="text-[10px] font-bold uppercase text-[var(--fg-muted)]">{text.totalOrder}</p>
              <p className="text-lg font-black text-[var(--fg-base)]">{formatMoney(totalAmount)}</p>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl border border-[var(--border-soft)] bg-white px-5 py-3 text-sm font-black text-[var(--fg-muted)] transition-colors hover:text-[var(--fg-base)]"
              >
                {text.cancel}
              </button>
              <button
                type="button"
                onClick={handleCreatePO}
                disabled={createPOMutation.isPending || saving}
                className="flex items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-6 py-3 text-sm font-black text-white shadow-lg shadow-emerald-700/15 transition-all hover:-translate-y-0.5 hover:opacity-95 disabled:translate-y-0 disabled:opacity-45"
              >
                <Plus className="size-4" />
                {createPOMutation.isPending || saving ? text.creating : text.create}
              </button>
            </div>
          </div>
        }
      >
        <div className="grid gap-5">
          <CreateFormSection
            title="Danh sách sản phẩm"
            description="Chọn sản phẩm, nhập số lượng và đơn giá. Mỗi dòng được tách rõ để dễ rà soát."
          >
            <div className="space-y-3">
              {poItems.map((item, idx) => (
                <div key={idx} className="space-y-3 rounded-3xl border border-[var(--border-soft)] bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="flex size-6 items-center justify-center rounded-lg bg-[var(--accent)] text-[10px] font-black text-white">
                        {idx + 1}
                      </div>
                      <span className="text-[12px] font-bold text-[var(--fg-base)]">{text.productLabel}</span>
                    </div>
                    {poItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="rounded-lg p-1.5 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>

                  <SmartSelector
                    items={allProducts.map((product) => ({
                      id: product.id,
                      label: product.name,
                      sublabel: text.priceInfoTemplate(
                        formatMoney(product.buyPriceVnd),
                        formatMoney(product.sellPriceVnd),
                      ),
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
                    placeholder={text.searchProductPlaceholder}
                    createLabel={text.createProduct}
                  />

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                    <div className="sm:col-span-3">
                      <label className="mb-1.5 block text-[10px] font-bold uppercase text-[var(--fg-muted)]">
                        {text.quantityLabel}
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
                        className="!py-2 text-center text-[13px] font-bold"
                      />
                    </div>
                    <div className="sm:col-span-5">
                      <label className="mb-1.5 block text-[10px] font-bold uppercase text-[var(--fg-muted)]">
                        {text.unitPriceLabel}
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
                        className="!py-2 text-[13px] font-mono"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <label className="mb-1.5 block text-[10px] font-bold uppercase text-[var(--fg-muted)]">
                        {text.amountLabel}
                      </label>
                      <div className="flex h-10 items-center rounded-xl border border-[var(--border-soft)] bg-[var(--surface-light)] px-3 font-black text-[var(--accent)]">
                        {formatMoney(item.quantity * item.priceVnd)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addItem}
                className="text-[12px] font-bold text-[var(--accent)] hover:underline"
              >
                <Plus className="mr-1 inline size-3.5" />
                {text.addProduct}
              </button>
            </div>
          </CreateFormSection>

          <CreateFormSection
            title="Thanh toán và ghi chú"
            description="Giữ các trường vận hành chính ở cùng một chỗ để nhập nhanh và không phải cuộn quá nhiều."
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                  <CreditCard className="size-3 text-[var(--accent)]" />
                  {text.payment}
                </label>
                <Select
                  value={poPaymentMethod}
                  onChange={(event) => setPOPaymentMethod(event.target.value)}
                  className="h-11 rounded-xl text-[13px] font-bold"
                >
                  <option value="bank_transfer">{text.paymentMethodLabels.bankTransfer}</option>
                  <option value="cash">{text.paymentMethodLabels.cash}</option>
                  <option value="credit">{text.paymentMethodLabels.credit}</option>
                </Select>
              </div>
              <div>
                <label className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                  <Calendar className="size-3 text-blue-500" />
                  {text.importDateLabel}
                </label>
                <input
                  type="date"
                  value={poImportDate}
                  onChange={(event) => setPOImportDate(event.target.value)}
                  className="h-11 w-full rounded-xl border border-[var(--border-soft)] bg-white px-3 text-[13px] font-bold text-[var(--fg-base)]"
                />
              </div>
              <div>
                <label className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                  <StickyNote className="size-3 text-amber-500" />
                  {text.notesLabel}
                </label>
                <Input
                  value={poNotes}
                  onChange={(event) => setPONotes(event.target.value)}
                  placeholder={text.notesPlaceholder}
                />
              </div>
            </div>
          </CreateFormSection>

          <AdvancedOptionsDisclosure title="Tùy chọn nâng cao">
            <div className="grid gap-4">
              <div>
                <label className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                  <Upload className="size-3" />
                  {text.proof}
                </label>
                <div className="mb-2 flex flex-wrap gap-2">
                  {poProofImages.map((image, index) => (
                    <div
                      key={`${image}-${index}`}
                      className="group relative h-20 w-20 overflow-hidden rounded-lg border border-[var(--border-soft)]"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image} alt={text.proofImageAlt(index + 1)} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() =>
                          setPOProofImages((current) => current.filter((_, currentIndex) => currentIndex !== index))
                        }
                        className="absolute right-0.5 top-0.5 rounded-full bg-red-500 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                  <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-[var(--border-soft)] transition-colors hover:border-[var(--accent)]">
                    <ImagePlus className="size-5 text-[var(--fg-muted)]" />
                    <span className="text-[9px] font-bold text-[var(--fg-muted)]">{text.uploadImage}</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(event) => {
                        Array.from(event.target.files || []).forEach((file) => {
                          const reader = new FileReader();
                          reader.onload = () => {
                            const imageData = reader.result;
                            if (typeof imageData === "string") {
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

              <div className="space-y-3 border-t border-[var(--border-soft)]/60 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setConnectToInventory((current) => !current);
                    if (connectToInventory) {
                      setSelectedSourceAccountId("");
                    }
                  }}
                  className={`flex w-full cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-[12px] font-bold transition-all ${
                    connectToInventory
                      ? "border-transparent bg-[var(--accent)]/10 text-[var(--accent)]"
                      : "border-2 border-[var(--border-soft)] bg-[var(--surface-light)] text-[var(--fg-muted)]"
                  }`}
                >
                  <Warehouse className="size-4" />
                  {text.connectInventory}
                  <span className="ml-1 rounded bg-[var(--border-soft)] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-[var(--fg-muted)]">
                    {connectToInventory ? text.toggleOn : text.toggleOff}
                  </span>
                  <ChevronDown className={`ml-auto size-3.5 transition-transform ${connectToInventory ? "rotate-180" : ""}`} />
                </button>

                {connectToInventory && (
                  <div className="space-y-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-light)] p-3">
                    {selectedProductIds.length > 0 && (
                      <p className="text-[10px] text-[var(--fg-muted)]">
                        <Search className="mr-1 inline-block size-3" />
                        {text.summaryCount(selectedProductIds.length)}
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
                          {text.selectedAccountPrefix} {selectedAccount.email}
                        </p>
                        <p className="mt-1 text-emerald-600">
                          {selectedAccount.maxSlots - selectedAccount.usedSlots} {text.availableSlotsSuffix} · {text.expiryLabel}{" "}
                          {formatDateLabel(selectedAccount.expiresAt)}
                        </p>
                        <p className="mt-1 text-emerald-600/80">
                          {text.productShortLabel}:{" "}
                          {selectedAccount.productIds.map((productId) => productMap.get(productId) || productId).join(", ")}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </AdvancedOptionsDisclosure>
        </div>
      </CreateFlowDialog>

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
