"use client";

import { X } from "lucide-react";
import type { Customer } from "@/lib/domain/types";
import { SearchMultiSelector } from "@/shared/ui/search-multi-selector";

interface CustomerMiniComboboxProps {
  customers: Customer[];
  value: string[];
  onChange: (ids: string[]) => void;
  onCreateNew: () => void;
}

export function CustomerMiniCombobox({
  customers,
  value,
  onChange,
  onCreateNew,
}: CustomerMiniComboboxProps) {
  const sorted = [...customers].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );

  const items = sorted.map((customer) => ({
    id: customer.id,
    label: customer.name,
    sublabel: customer.contacts.find((contact) => contact.isPrimary)?.value || customer.contacts[0]?.value || "No contact",
    createdAt: customer.createdAt,
  }));

  return (
    <SearchMultiSelector
      items={items}
      value={value}
      onChange={onChange}
      onCreateNew={onCreateNew}
      placeholder="Tìm khách hàng..."
      createLabel="Tạo khách hàng mới"
      emptyText="Không tìm thấy khách hàng phù hợp"
      maxPanelHeight={340}
    />
  );
}

interface CustomerBadgeListProps {
  customerIds: string[];
  customers: Customer[];
  onRemove: (id: string) => void;
}

export function CustomerBadgeList({
  customerIds,
  customers,
  onRemove,
}: CustomerBadgeListProps) {
  if (customerIds.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {customerIds.map((customerId) => {
        const customer = customers.find((item) => item.id === customerId);
        if (!customer) return null;

        return (
          <span
            key={customerId}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent)]/20 bg-[var(--accent)]/10 px-2.5 py-1 text-[11px] font-bold text-[var(--accent)]"
          >
            <span className="flex size-4 items-center justify-center rounded-full bg-[var(--accent)]/20 text-[8px] font-black">
              {customer.name.charAt(0).toUpperCase()}
            </span>
            {customer.name}
            <button
              type="button"
              onClick={() => onRemove(customerId)}
              className="rounded-full p-0.5 transition-colors hover:bg-[var(--danger)]/10 hover:text-[var(--danger)]"
            >
              <X className="size-3" />
            </button>
          </span>
        );
      })}
    </div>
  );
}
