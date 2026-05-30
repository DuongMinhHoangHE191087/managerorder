"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Plus, Zap } from "lucide-react";
import type { Customer } from "@/lib/domain/types";
import { PageHeader } from "@/shared/ui/page-layout";
import { Button } from "@/shared/ui/button";
import { vi } from "@/shared/messages/vi";

const CustomerExport = dynamic(() => import("@/widgets/pages/customers/components/customer-export").then((m) => ({ default: m.CustomerExport })), { ssr: false });
const CustomerImport = dynamic(() => import("@/widgets/pages/customers/components/customer-import").then((m) => ({ default: m.CustomerImport })), { ssr: false });

type CustomersPageHeaderProps = {
  customers: Customer[];
  isRecalculating: boolean;
  onCreateClick: () => void;
  onRecalculateRfm: () => void;
};

export const CustomersPageHeader = React.memo(function CustomersPageHeader({
  customers,
  isRecalculating,
  onCreateClick,
  onRecalculateRfm,
}: CustomersPageHeaderProps) {
  return (
    <PageHeader
      title={vi.customers.header.title}
      eyebrow="Customer Workspace"
      actions={
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={onRecalculateRfm}
            disabled={isRecalculating}
          >
            {isRecalculating ? (
              <div className="size-4 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
            ) : (
              <Zap className="size-4" />
            )}
            {isRecalculating ? vi.customers.header.recalculating : vi.customers.header.recalculate}
          </Button>
          <CustomerImport />
          <CustomerExport customers={customers} />
          <Button type="button" variant="primary" onClick={onCreateClick}>
            <Plus className="size-4" />
            {vi.customers.header.create}
          </Button>
        </>
      }
      className="mt-2"
    />
  );
});
