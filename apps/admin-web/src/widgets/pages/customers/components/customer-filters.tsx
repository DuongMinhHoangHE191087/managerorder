"use client";

import React from "react";
import { AlertTriangle, Search, X } from "lucide-react";
import type { CustomerGroup, CustomerTag } from "@/shared/types/customers";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { Button } from "@/shared/ui/button";
import { FiltersBar } from "@/shared/ui/page-layout";
import { vi } from "@/shared/messages/vi";
import { hasSearchTokens } from "@/shared/lib/filtering/search";

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
  searchQuery,
  onSearchChange,
  groupFilter,
  onGroupFilterChange,
  typeFilter,
  onTypeFilterChange,
  debtOnly,
  onDebtOnlyChange,
  tagFilter,
  onTagFilterChange,
  groups,
  tags,
}: CustomerFiltersProps) {
  const hasFilters = Boolean(hasSearchTokens(searchQuery) || groupFilter || typeFilter || tagFilter || debtOnly);

  const CUSTOMER_TYPE_CHIPS = React.useMemo(() => [
    { value: "", label: vi.customers.filters.allTypes },
    { value: "retail", label: vi.customers.filters.retail },
    { value: "wholesale", label: vi.customers.filters.wholesale },
    { value: "agency", label: vi.customers.filters.agency },
  ], []);

  return (
    <div className="flex flex-col gap-3">
      <FiltersBar sticky className="px-4 py-2">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto_auto] items-center">
          <div className="relative min-w-0">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--fg-muted)]" />
            <Input
              aria-label="Tìm khách hàng"
              type="text"
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={vi.customers.filters.searchPlaceholder}
              className="h-9 pl-9 text-sm"
            />
          </div>

          <Select
            value={groupFilter}
            onChange={(event) => onGroupFilterChange(event.target.value)}
            className="h-9 !w-auto min-w-[10rem] rounded-xl text-xs font-bold"
          >
            <option value="">{vi.customers.filters.allGroups}</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </Select>

          {tags.length > 0 ? (
            <Select
              value={tagFilter}
              onChange={(event) => onTagFilterChange(event.target.value)}
              className="h-9 !w-auto min-w-[10rem] rounded-xl text-xs font-bold"
            >
              <option value="">{vi.customers.filters.allTags}</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </Select>
          ) : null}

          <Button
            type="button"
            variant={debtOnly ? "danger" : "secondary"}
            className="h-9 text-xs px-3"
            onClick={() => onDebtOnlyChange(!debtOnly)}
          >
            <AlertTriangle className="size-3.5 mr-1" />
            {vi.customers.filters.debtOnly}
          </Button>

          <div className="flex items-center justify-end">
            <Button
              type="button"
              variant="ghost"
              className="h-9 text-sm px-3"
              disabled={!hasFilters}
              onClick={() => {
                onSearchChange("");
                onGroupFilterChange("");
                onTypeFilterChange("");
                onTagFilterChange("");
                onDebtOnlyChange(false);
              }}
            >
              <X className="size-4 mr-1" />
              Xóa lọc
            </Button>
          </div>
        </div>
      </FiltersBar>

      <div className="flex flex-wrap gap-2 px-1 mb-4">
        {CUSTOMER_TYPE_CHIPS.map((chip) => (
          <button
            key={chip.value}
            type="button"
            onClick={() => onTypeFilterChange(chip.value)}
            className={`rounded-full px-4 py-1.5 text-[12px] font-bold transition-all duration-150 border ${
              typeFilter === chip.value
                ? "border-slate-800 bg-white text-slate-800 ring-1 ring-slate-800 shadow-sm"
                : "border-transparent bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
});
