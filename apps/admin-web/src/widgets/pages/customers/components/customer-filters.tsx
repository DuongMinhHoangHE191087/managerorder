"use client";

import React from "react";
import { AlertTriangle, Search } from "lucide-react";
import type { CustomerGroup, CustomerTag } from "@/shared/types/customers";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { Button } from "@/shared/ui/button";
import { ToolbarField, WorkspaceToolbar } from "@/shared/ui/admin-workspace";
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

  return (
    <WorkspaceToolbar className="mb-5">
      <ToolbarField
        label="Tìm kiếm nhanh"
        description="Giữ cùng một thanh điều khiển cho list khách hàng, customer detail và các dashboard liên quan."
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--fg-muted)]" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={vi.customers.filters.searchPlaceholder}
            className="h-11 pl-10"
          />
        </div>
      </ToolbarField>

      <ToolbarField
        label="Bộ lọc vận hành"
        description="Lọc theo nhóm, phân loại, tag và công nợ mà không cần rời khỏi màn hiện tại."
      >
        <div className="flex flex-wrap gap-2">
          <Select
            value={groupFilter}
            onChange={(event) => onGroupFilterChange(event.target.value)}
            className="h-11 !w-auto min-w-[11rem] rounded-xl text-[13px] font-bold"
          >
            <option value="">{vi.customers.filters.allGroups}</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </Select>

          <Select
            value={typeFilter}
            onChange={(event) => onTypeFilterChange(event.target.value)}
            className="h-11 !w-auto min-w-[11rem] rounded-xl text-[13px] font-bold"
          >
            <option value="">{vi.customers.filters.allTypes}</option>
            <option value="retail">{vi.customers.filters.retail}</option>
            <option value="wholesale">{vi.customers.filters.wholesale}</option>
            <option value="agency">{vi.customers.filters.agency}</option>
          </Select>

          {tags.length > 0 ? (
            <Select
              value={tagFilter}
              onChange={(event) => onTagFilterChange(event.target.value)}
              className="h-11 !w-auto min-w-[11rem] rounded-xl text-[13px] font-bold"
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
            className="h-11"
            onClick={() => onDebtOnlyChange(!debtOnly)}
          >
            <AlertTriangle className="size-4" />
            {vi.customers.filters.debtOnly}
          </Button>

          {hasFilters ? (
            <Button
              type="button"
              variant="ghost"
              className="h-11"
              onClick={() => {
                onSearchChange("");
                onGroupFilterChange("");
                onTypeFilterChange("");
                onTagFilterChange("");
                onDebtOnlyChange(false);
              }}
            >
              Xóa bộ lọc
            </Button>
          ) : null}
        </div>
      </ToolbarField>
    </WorkspaceToolbar>
  );
});
