"use client";

import dynamic from "next/dynamic";
import { Clock, Link2, ShieldCheck, Trash2 } from "lucide-react";
import type { LicenseKey, ProductService, Provider, SourceAccount } from "@/lib/domain/types";
import { Modal } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/button";
import { AccountShareLauncher } from "@/widgets/pages/inventory/components/account-share-launcher";
import { INVENTORY_COPY as copy } from "../copy";

const SlideOverDrawer = dynamic(() => import("@/shared/ui/slide-over-drawer").then((m) => ({ default: m.SlideOverDrawer })), { ssr: false });
const ActivityTimeline = dynamic(() => import("@/widgets/pages/activity-logs/components/activity-timeline").then((m) => ({ default: m.ActivityTimeline })), { ssr: false });
const SourceAccountConnections = dynamic(() => import("@/widgets/pages/inventory/components/source-account-connections").then((m) => ({ default: m.SourceAccountConnections })), { ssr: false });
const SmartMatchPanel = dynamic(() => import("@/widgets/pages/inventory/components/smart-match-panel").then((m) => ({ default: m.SmartMatchPanel })), { ssr: false });
const InventoryDetailDrawer = dynamic(() => import("@/widgets/pages/inventory/components/inventory-detail-drawer").then((m) => ({ default: m.InventoryDetailDrawer })), { ssr: false });
const CreateSourceAccountModal = dynamic(() => import("@/widgets/pages/inventory/components/create-source-account-modal").then((m) => ({ default: m.CreateSourceAccountModal })), { ssr: false });
const EditSourceAccountModal = dynamic(() => import("@/widgets/pages/inventory/components/create-source-account-modal").then((m) => ({ default: m.EditSourceAccountModal })), { ssr: false });
const CreateLicenseKeyModal = dynamic(() => import("@/widgets/pages/inventory/components/create-license-key-modal").then((m) => ({ default: m.CreateLicenseKeyModal })), { ssr: false });
const DeleteLicenseKeyModal = dynamic(() => import("@/widgets/pages/inventory/components/create-license-key-modal").then((m) => ({ default: m.DeleteLicenseKeyModal })), { ssr: false });
const LicenseKeyDetailModal = dynamic(() => import("@/widgets/pages/inventory/components/license-key-detail-modal").then((m) => ({ default: m.LicenseKeyDetailModal })), { ssr: false });

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
  isLicenseKeyDetailOpen: boolean;
  isRecalculating: boolean;
  onCloseCreateAccount: () => void;
  onCloseCreateKey: () => void;
  onCloseDrawer: () => void;
  onCloseEditAccount: () => void;
  onCloseDeleteKey: () => void;
  onCloseLicenseKeyDetail: () => void;
  onCreateAccount: (body: InventoryBody) => Promise<void>;
  onCreateKey: (body: LicenseKeyBody) => Promise<void>;
  onDeleteKey: () => Promise<void>;
  onEditAccount: (body: InventoryBody & { id: string }) => Promise<void>;
  onEditSelectedAccount: () => void;
  onRestoreLicenseKey: () => Promise<void>;
  onPurgeLicenseKey: () => Promise<void>;
  onRecalculateSelectedAccount: () => Promise<void>;
  onCloseBulkDelete: () => void;
  onConfirmBulkDelete: () => Promise<void>;
  productMap: Map<string, string>;
  products: ProductService[];
  providers: Provider[];
  providerById: Map<string, Provider>;
  selectedAccount: SourceAccount | null;
  selectedLicenseKeyId: string | null;
  selectedLicenseKeyTrashMode: boolean;
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
  isLicenseKeyDetailOpen,
  isRecalculating,
  onCloseCreateAccount,
  onCloseCreateKey,
  onCloseDrawer,
  onCloseEditAccount,
  onCloseDeleteKey,
  onCloseLicenseKeyDetail,
  onCreateAccount,
  onCreateKey,
  onDeleteKey,
  onEditAccount,
  onEditSelectedAccount,
  onRestoreLicenseKey,
  onPurgeLicenseKey,
  onRecalculateSelectedAccount,
  onCloseBulkDelete,
  onConfirmBulkDelete,
  productMap,
  products,
  providers,
  providerById,
  selectedAccount,
  selectedLicenseKeyId,
  selectedLicenseKeyTrashMode,
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
        title={copy.overlays.drawerTitle(selectedAccount?.email)}
        width="max-w-lg"
      >
        {selectedAccount ? (
          <InventoryDetailDrawer
            account={selectedAccount}
            productMap={productMap}
            providerById={providerById}
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
                  <ShieldCheck className="size-3.5 text-[var(--accent)]" />
                  Chia sẻ tài khoản
                </h3>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <p className="text-[12px] text-[var(--fg-muted)]">Tạo link chia sẻ bảo mật cho khách hàng</p>
                <AccountShareLauncher
                  account={{ id: selectedAccount.id, email: selectedAccount.email }}
                  label="Quản lý chia sẻ"
                  variant="secondary"
                  size="sm"
                />
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-[var(--border-soft)] bg-white">
              <div className="border-b border-[var(--border-soft)] bg-gray-50/50 px-4 py-3">
                <h3 className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                  <Link2 className="size-3.5 text-[var(--accent)]" />
                  {copy.overlays.connectionsTitle}
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
                  {copy.overlays.activityTitle}
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

      <LicenseKeyDetailModal
        isOpen={isLicenseKeyDetailOpen}
        licenseKeyId={selectedLicenseKeyId}
        includeDeleted={selectedLicenseKeyTrashMode}
        productMap={productMap}
        onClose={onCloseLicenseKeyDetail}
        onRestore={onRestoreLicenseKey}
        onPurge={onPurgeLicenseKey}
      />

      <CreateLicenseKeyModal isOpen={isCreateKeyOpen} onClose={onCloseCreateKey} products={products} onSubmit={onCreateKey} />
      <DeleteLicenseKeyModal licenseKey={deletingKey} onClose={onCloseDeleteKey} onConfirm={onDeleteKey} />

      <Modal
        isOpen={showBulkDeleteConfirm}
        onClose={onCloseBulkDelete}
        title={copy.overlays.bulkDelete.title}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-red-500/10 p-2">
              <Trash2 className="size-6 text-red-500" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--fg-base)]">{copy.overlays.bulkDelete.heading}</h3>
              <p className="text-sm text-[var(--fg-muted)]">{copy.overlays.bulkDelete.description}</p>
            </div>
          </div>
          <p className="text-sm text-[var(--fg-muted)]">
            {copy.overlays.bulkDelete.body(selectedIdsCount)}
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onCloseBulkDelete}>
              {copy.overlays.bulkDelete.cancel}
            </Button>
            <Button variant="danger" onClick={onConfirmBulkDelete}>
              {copy.overlays.bulkDelete.confirm(selectedIdsCount)}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
