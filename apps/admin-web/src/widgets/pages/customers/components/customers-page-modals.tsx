"use client";

import dynamic from "next/dynamic";
import {
  BatchDeleteModal,
  BatchTagModal,
  BatchTierModal,
  DeleteCustomerModal,
  GroupAssignModal,
  RenewalModal,
} from "@/widgets/pages/customers/components/customer-modals";
import type { Customer } from "@/lib/domain/types";
import type { CustomerGroup, CustomerTag } from "@/shared/types/customers";

const CustomerCreateModal = dynamic(() => import("@/widgets/pages/customers/components/customer-create-modal").then((m) => ({ default: m.CustomerCreateModal })), { ssr: false });
const CustomerEditModal = dynamic(() => import("@/widgets/pages/customers/components/customer-edit-modal").then((m) => ({ default: m.CustomerEditModal })), { ssr: false });

type CustomersPageModalsProps = {
  allTags: CustomerTag[];
  assignToGroupPending: boolean;
  batchDepInfo: { customersWithOrders: number; totalOrders: number } | null;
  batchDeletePending: boolean;
  batchTagPending: boolean;
  batchTierPending: boolean;
  createGroupPending: boolean;
  deletingCustomer: Customer | null;
  editingCustomer: Customer | null;
  groups: CustomerGroup[];
  isCreateOpen: boolean;
  renewingCustomer: Customer | null;
  selectedCount: number;
  showBatchDeleteConfirm: boolean;
  showBatchTagModal: boolean;
  showBatchTierModal: boolean;
  showGroupModal: boolean;
  onAssignToGroup: (groupId: string) => void;
  onBatchDeleteConfirm: () => void;
  onBatchTagAssign: (tagId: string) => void;
  onBatchTierConfirm: (tier: "retail" | "wholesale" | "agency") => void;
  onCloseBatchDelete: () => void;
  onCloseBatchTag: () => void;
  onCloseBatchTier: () => void;
  onCloseCreate: () => void;
  onCloseDelete: () => void;
  onCloseEdit: () => void;
  onCloseGroup: () => void;
  onCloseRenewal: () => void;
  onCreateGroup: (input: { name: string; color: string; description?: string }) => Promise<{ data: { id: string } }>;
  onDeleteConfirm: () => void;
  onOpenGroupTag: () => void;
  onRenewalSave: (debtDays: string, debtAmount: string) => Promise<void>;
};

export function CustomersPageModals({
  allTags,
  assignToGroupPending,
  batchDepInfo,
  batchDeletePending,
  batchTagPending,
  batchTierPending,
  createGroupPending,
  deletingCustomer,
  editingCustomer,
  groups,
  isCreateOpen,
  renewingCustomer,
  selectedCount,
  showBatchDeleteConfirm,
  showBatchTagModal,
  showBatchTierModal,
  showGroupModal,
  onAssignToGroup,
  onBatchDeleteConfirm,
  onBatchTagAssign,
  onBatchTierConfirm,
  onCloseBatchDelete,
  onCloseBatchTag,
  onCloseBatchTier,
  onCloseCreate,
  onCloseDelete,
  onCloseEdit,
  onCloseGroup,
  onCloseRenewal,
  onCreateGroup,
  onDeleteConfirm,
  onOpenGroupTag,
  onRenewalSave,
}: CustomersPageModalsProps) {
  return (
    <>
      <CustomerCreateModal isOpen={isCreateOpen} onClose={onCloseCreate} defaultEntityType="customer" onSuccess={() => {}} />
      {editingCustomer ? (
        <CustomerEditModal isOpen={!!editingCustomer} onClose={onCloseEdit} customer={editingCustomer} onSuccess={() => {}} />
      ) : null}
      <DeleteCustomerModal customer={deletingCustomer} onClose={onCloseDelete} onConfirm={onDeleteConfirm} />
      <BatchDeleteModal
        isOpen={showBatchDeleteConfirm}
        selectedCount={selectedCount}
        depInfo={batchDepInfo}
        isPending={batchDeletePending}
        onClose={onCloseBatchDelete}
        onConfirm={onBatchDeleteConfirm}
      />
      <BatchTierModal
        isOpen={showBatchTierModal}
        selectedCount={selectedCount}
        isPending={batchTierPending}
        onClose={onCloseBatchTier}
        onConfirm={onBatchTierConfirm}
      />
      <GroupAssignModal
        isOpen={showGroupModal}
        selectedCount={selectedCount}
        groups={groups}
        isAssigning={assignToGroupPending}
        isCreating={createGroupPending}
        onClose={onCloseGroup}
        onAssign={onAssignToGroup}
        onCreate={onCreateGroup}
      />
      <BatchTagModal
        isOpen={showBatchTagModal}
        selectedCount={selectedCount}
        tags={allTags}
        isPending={batchTagPending}
        onClose={onCloseBatchTag}
        onAssign={onBatchTagAssign}
        onOpenGroupTag={onOpenGroupTag}
      />
      <RenewalModal customer={renewingCustomer} onClose={onCloseRenewal} onSave={onRenewalSave} />
    </>
  );
}
