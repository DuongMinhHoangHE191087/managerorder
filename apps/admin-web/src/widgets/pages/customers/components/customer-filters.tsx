"use client";

import React from "react";
import { Search, AlertTriangle } from "lucide-react";
import type { CustomerGroup, CustomerTag } from "@/shared/types/customers";
import { Select } from "@/shared/ui/select";
import { vi } from "@/shared/messages/vi";

interface CustomerFiltersProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  groupFilter: string;
  onGroupFilterChange: (id: string) => void;
  typeFilter: string;
  onTypeFilterChange: (t: string) => void;
  debtOnly: boolean;
  onDebtOnlyChange: (v: boolean) => void;
  tagFilter: string;
  onTagFilterChange: (id: string) => void;
  groups: CustomerGroup[];
  tags: CustomerTag[];
}

export const CustomerFilters = React.memo(function CustomerFilters({
  searchQuery, onSearchChange,
  groupFilter, onGroupFilterChange,
  typeFilter, onTypeFilterChange,
  debtOnly, onDebtOnlyChange,
  tagFilter, onTagFilterChange,
  groups, tags,
}: CustomerFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-4">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-muted)] size-4" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          placeholder={vi.customers.filters.searchPlaceholder}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-[var(--border-soft)] rounded-xl text-[13px] font-medium outline-none focus:border-[var(--accent)] transition-colors placeholder:text-[var(--fg-muted)]"
          />
      </div>
      <div className="flex gap-2 flex-wrap">
        <Select
          value={groupFilter}
          onChange={(e) => onGroupFilterChange(e.target.value)}
          className="h-11 !w-auto min-w-[11rem] rounded-xl text-[13px] font-bold"
        >
          <option value="">{vi.customers.filters.allGroups}</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </Select>
        <Select
          value={typeFilter}
          onChange={(e) => onTypeFilterChange(e.target.value)}
          className="h-11 !w-auto min-w-[11rem] rounded-xl text-[13px] font-bold"
        >
          <option value="">{vi.customers.filters.allTypes}</option>
          <option value="retail">{vi.customers.filters.retail}</option>
          <option value="wholesale">{vi.customers.filters.wholesale}</option>
          <option value="agency">{vi.customers.filters.agency}</option>
        </Select>
        <button
          onClick={() => onDebtOnlyChange(!debtOnly)}
          className={`px-4 py-2.5 border rounded-xl text-[13px] font-bold transition-colors flex items-center gap-2 ${debtOnly ? "bg-[var(--danger)]/10 text-[var(--danger)] border-[var(--danger)]/30 shadow-sm" : "bg-white text-[var(--fg-muted)] border-[var(--border-soft)] hover:bg-gray-50"}`}
        >
          <AlertTriangle className="size-4" />
          {vi.customers.filters.debtOnly}
        </button>
        {tags.length > 0 && (
          <Select
            value={tagFilter}
            onChange={(e) => onTagFilterChange(e.target.value)}
            className="h-11 !w-auto min-w-[11rem] rounded-xl text-[13px] font-bold"
          >
            <option value="">{vi.customers.filters.allTags}</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>{tag.name}</option>
            ))}
          </Select>
        )}
      </div>
    </div>
  );
});
