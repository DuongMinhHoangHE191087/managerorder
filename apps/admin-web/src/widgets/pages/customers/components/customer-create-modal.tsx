"use client";

import { CreateSurfaceDialog } from "@/shared/ui/create-flow-shell";
import type { CreateCustomerResult } from "@/shared/types/customers";
import {
  CustomerCreateSurface,
  type EntityType,
} from "@/widgets/pages/customers/components/customer-create-surface";

interface CustomerCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (customer: CreateCustomerResult) => void;
  initialName?: string;
  defaultEntityType?: EntityType;
}

export function CustomerCreateModal({
  isOpen,
  onClose,
  onSuccess,
  initialName = "",
  defaultEntityType = "customer",
}: CustomerCreateModalProps) {
  return (
    <CreateSurfaceDialog
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      panelClassName="max-w-6xl"
    >
      <CustomerCreateSurface
        mode="modal"
        initialName={initialName}
        defaultEntityType={defaultEntityType}
        onCancel={onClose}
        onSuccess={(customer) => {
          onSuccess(customer);
          onClose();
        }}
      />
    </CreateSurfaceDialog>
  );
}
