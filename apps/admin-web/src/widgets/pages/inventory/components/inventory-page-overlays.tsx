"use client";

import dynamic from "next/dynamic";
import { Clock, Link2, Trash2 } from "lucide-react";
import type { LicenseKey, ProductService, Provider, SourceAccount } from "@/lib/domain/types";
import { Modal } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/button";

const SlideOverDrawer = dynamic(() => import("@/shared/ui/slide-over-drawer").then((m) => ({ default: m.SlideOverDrawer })), { ssr: false });
const ActivityTimeline = dynamic(() => import("@/widgets/pages/activity-logs/components/activity-timeline").then((m) => ({ default: m.ActivityTimeline })), { ssr: false });
const SourceAccountConnections = dynamic(() => import("@/widgets/pages/inventory/components/source-account-connections").then((m) => ({ default: m.SourceAccountConnections })), { ssr: false });
const SmartMatchPanel = dynamic(() => import("@/widgets/pages/inventory/components/smart-match-panel").then((m) => ({ default: m.SmartMatchPanel })), { ssr: false });
const InventoryDetailDrawer = dynamic(() => import("@/widgets/pages/inventory/components/inventory-detail-drawer").then((m) => ({ default: m.InventoryDetailDrawer })), { ssr: false });
const CreateSourceAccountModal = dynamic(() => import("@/widgets/pages/inventory/components/create-source-account-modal").then((m) => ({ default: m.CreateSourceAccountModal })), { ssr: false });
const EditSourceAccountModal = dynamic(() => import("@/widgets/pages/inventory/components/create-source-account-modal").then((m) => ({ default: m.EditSourceAccountModal })), { ssr: false });
const CreateLicenseKeyModal = dynamic(() => import("@/widgets/pages/inventory/components/create-license-key-modal").then((m) => ({ default: m.CreateLicenseKeyModal })), { ssr: false });
const DeleteLicenseKeyModal = dynamic(() => import("@/widgets/pages/inventory/components/create-license-key-modal").then((m) => ({ default: m.DeleteLicenseKeyModal })), { ssr: false });

type InventoryBody = {
  email: string;
  provider: string;
  productIds: string[];
  maxSlots: number;
  expiresAt: string;
  credentials?: Array<{ type: string; value: string; label?: string }>;
  purchaseCostVnd?: number;
  purchaseDate?: string;
  purchaseSource?: string;
};

type LicenseKeyBody = {
  keyCode: string;
  productId: string;
  status: "available" | "reserved" | "used" | "expired" | "invalid";
};

type InventoryPageOverlaysProps = {
  deletingKey: LicenseKey | null;
  editingAccount: SourceAccount | null;
  isCreateAccountOpen: boolean;
  isCreateKeyOpen: boolean;
  isDrawerOpen: boolean;
  isRecalculating: boolean;
  onCloseCreateAccount: () => void;
  onCloseCreateKey: () => void;
  onCloseDrawer: () => void;
  onCloseEditAccount: () => void;
  onCloseDeleteKey: () => void;
  onCreateAccount: (body: InventoryBody) => Promise<void>;
  onCreateKey: (body: LicenseKeyBody) => Promise<void>;
  onDeleteKey: () => Promise<void>;
  onEditAccount: (body: InventoryBody & { id: string }) => Promise<void>;
  onEditSelectedAccount: () => void;
  onRecalculateSelectedAccount: () => Promise<void>;
  onCloseBulkDelete: () => void;
  onConfirmBulkDelete: () => Promise<void>;
  productMap: Map<string, string>;
  products: ProductService[];
  providers: Provider[];
  selectedAccount: SourceAccount | null;
  selectedIdsCount: number;
  showBulkDeleteConfirm: boolean;
  showSmartMatch: boolean;
  onCloseSmartMatch: () => void;
};

export function InventoryPageOverlays({
  deletingKey,
  editingAccount,
  isCreateAccountOpen,
  isCreateKeyOpen,
  isDrawerOpen,
  isRecalculating,
  onCloseCreateAccount,
  onCloseCreateKey,
  onCloseDrawer,
  onCloseEditAccount,
  onCloseDeleteKey,
  onCreateAccount,
  onCreateKey,
  onDeleteKey,
  onEditAccount,
  onEditSelectedAccount,
  onRecalculateSelectedAccount,
  onCloseBulkDelete,
  onConfirmBulkDelete,
  productMap,
  products,
  providers,
  selectedAccount,
  selectedIdsCount,
  showBulkDeleteConfirm,
  showSmartMatch,
  onCloseSmartMatch,
}: InventoryPageOverlaysProps) {
  return (
    <>
      {showSmartMatch ? <SmartMatchPanel onClose={onCloseSmartMatch} /> : null}

      <SlideOverDrawer
        isOpen={isDrawerOpen}
        onClose={onCloseDrawer}
        title={selectedAccount ? `Kho: ${selectedAccount.email}` : "Kho dữ liệu"}
        width="max-w-lg"
      >
        {selectedAccount ? (
          <InventoryDetailDrawer
            account={selectedAccount}
            productMap={productMap}
            providers={providers}
            onEdit={() => {
              onCloseDrawer();
              onEditSelectedAccount();
            }}
            onRecalculate={onRecalculateSelectedAccount}
            isRecalculating={isRecalculating}
          >
            <div className="overflow-hidden rounded-xl border border-[var(--border-soft)] bg-white">
              <div className="border-b border-[var(--border-soft)] bg-gray-50/50 px-4 py-3">
                <h3 className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                  <Link2 className="size-3.5 text-[var(--accent)]" />
                  Quản lý Kết nối
                </h3>
              </div>
              <div className="max-h-[350px] overflow-y-auto p-3 custom-scrollbar">
                <SourceAccountConnections
                  sourceAccountId={selectedAccount.id}
                  maxSlots={selectedAccount.maxSlots}
                  usedSlots={selectedAccount.usedSlots}
                  productMap={productMap}
                />
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-[var(--border-soft)] bg-white">
              <div className="border-b border-[var(--border-soft)] bg-gray-50/50 px-4 py-3">
                <h3 className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                  <Clock className="size-3.5 text-[var(--accent)]" />
                  Lịch sử hoạt động
                </h3>
              </div>
              <div className="max-h-[300px] overflow-y-auto p-3 custom-scrollbar">
                <ActivityTimeline sourceAccountId={selectedAccount.id} />
              </div>
            </div>
          </InventoryDetailDrawer>
        ) : null}
      </SlideOverDrawer>

      <CreateSourceAccountModal
        isOpen={isCreateAccountOpen}
        onClose={onCloseCreateAccount}
        providers={providers}
        products={products}
        productMap={productMap}
        onSubmit={onCreateAccount}
      />

      <EditSourceAccountModal
        account={editingAccount}
        onClose={onCloseEditAccount}
        providers={providers}
        products={products}
        productMap={productMap}
        onSubmit={onEditAccount}
      />

      <CreateLicenseKeyModal isOpen={isCreateKeyOpen} onClose={onCloseCreateKey} products={products} onSubmit={onCreateKey} />
      <DeleteLicenseKeyModal licenseKey={deletingKey} onClose={onCloseDeleteKey} onConfirm={onDeleteKey} />

      <Modal
        isOpen={showBulkDeleteConfirm}
        onClose={onCloseBulkDelete}
        title="Xác nhận xóa hàng loạt"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-red-500/10 p-2">
              <Trash2 className="size-6 text-red-500" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--fg-base)]">Xác nhận xóa hàng loạt</h3>
              <p className="text-sm text-[var(--fg-muted)]">Hành động này không thể hoàn tác</p>
            </div>
          </div>
          <p className="text-sm text-[var(--fg-muted)]">
            Bạn có chắc muốn xóa <span className="font-bold text-red-500">{selectedIdsCount}</span> tài khoản nguồn đã chọn?
            Tất cả kết nối và dữ liệu slot liên quan sẽ bị mất.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onCloseBulkDelete}>
              Hủy
            </Button>
            <Button variant="danger" onClick={onConfirmBulkDelete}>
              Xóa {selectedIdsCount} mục
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
