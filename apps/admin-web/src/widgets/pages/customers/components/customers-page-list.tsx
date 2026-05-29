"use client";



import React, { useMemo } from "react";

import dynamic from "next/dynamic";

import { ChevronLeft, ChevronRight, CheckCircle2, DollarSign, Eye, Pencil, Trash2, Users } from "lucide-react";

import { ActionMenu } from "@/shared/ui/action-menu";

import { Button } from "@/shared/ui/button";

import { cn, formatMoney } from "@/lib/utils";

import type { Customer } from "@/lib/domain/types";

import { vi } from "@/shared/messages/vi";



const RfmBadge = dynamic(() => import("@/widgets/pages/customers/components/rfm-badge").then((m) => ({ default: m.RfmBadge })), { ssr: false });



type CustomerGroup = {

  id: string;

  color: string;

  name: string;

};



type CustomersPageListProps = {

  customers: Customer[];

  debouncedQuery: string;

  groups: CustomerGroup[];

  isLoading: boolean;

  onClearDebt: (id: string) => void;

  onDeleteCustomer: (customer: Customer) => void;

  onEditCustomer: (customer: Customer) => void;

  onOpenCustomer: (customerId: string) => void;

  onPageIndexChange: (pageIndex: number) => void;

  onPageSizeChange: (pageSize: number) => void;

  onRenewCustomer: (customer: Customer) => void;

  onCreateFirstCustomer: () => void;

  onToggleSelect: (id: string) => void;

  onToggleSelectAll: () => void;

  pageCount: number;

  pageIndex: number;

  pageSize: number;

  selectedCount: number;

  selectedIds: Set<string>;

  totalElements: number;

  allFilteredSelected: boolean;

};



function getDebtBadge(amount: number, overdueDays: number) {

  if (amount <= 0) return { label: vi.customers.list.safe, class: "bg-[var(--accent)]/10 text-[var(--accent)]" };

  if (overdueDays > 30) return { label: vi.customers.list.overdue, class: "bg-[var(--danger)]/10 text-[var(--danger)]" };

  if (overdueDays > 7) return { label: vi.customers.list.dueSoon, class: "bg-[var(--warning)]/10 text-[var(--warning)]" };

  return { label: vi.customers.list.hasDebt, class: "bg-[var(--warning)]/10 text-[var(--warning)]" };

}



function getPrimaryContact(contacts: Array<{ isPrimary?: boolean; value: string }>) {

  if (contacts.length === 0) {

    return null;

  }



  for (const contact of contacts) {

    if (contact.isPrimary) {

      return contact;

    }

  }



  return contacts[0] ?? null;

}



function formatTierLabel(tier: Customer["tier"]) {

  return tier === "vip" ? vi.customers.list.tierVip : vi.customers.list.tierLoyal;

}



type CustomerListRowProps = {

  customer: Customer;

  groupMap: Map<string, CustomerGroup>;

  isSelected: boolean;

  onClearDebt: (id: string) => void;

  onDeleteCustomer: (customer: Customer) => void;

  onEditCustomer: (customer: Customer) => void;

  onOpenCustomer: (customerId: string) => void;

  onRenewCustomer: (customer: Customer) => void;

  onToggleSelect: (id: string) => void;

};



const CustomerListRow = React.memo(function CustomerListRow({

  customer,

  groupMap,

  isSelected,

  onClearDebt,

  onDeleteCustomer,

  onEditCustomer,

  onOpenCustomer,

  onRenewCustomer,

  onToggleSelect,

}: CustomerListRowProps) {

  const badge = getDebtBadge(customer.debtAmountVnd, customer.debtOverdueDays);

  const group = customer.group_id ? groupMap.get(customer.group_id) : undefined;

  const contact = getPrimaryContact(customer.contacts);

  const tags = customer.tags ?? [];



  return (

    <div

      data-testid="customer-row"

      onClick={() => {

        if (customer.id) onOpenCustomer(customer.id);

      }}

      className={cn(

        "group relative flex cursor-pointer flex-col gap-5 rounded-[1.5rem] border bg-[rgba(255,255,255,0.96)] p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)] transition-[background-color,border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(15,23,42,0.08)] active:scale-[0.99] md:flex-row md:p-5",

        isSelected

          ? "border-[var(--accent)] bg-[var(--accent)]/5 shadow-[0_4px_20px_rgba(var(--accent-rgb),0.08)]"

          : "border-[var(--border-soft)] hover:border-[var(--accent)]/40 hover:bg-gray-50/50",

      )}

    >

      <div className="flex items-start gap-4">

        <div

          className="pt-1"

          onClick={(event) => {

            event.stopPropagation();

            onToggleSelect(customer.id);

          }}

        >

          <div

            className={cn(

              "flex h-5 w-5 items-center justify-center rounded-md border-2 transition-[background-color,border-color]",

              isSelected ? "border-[var(--accent)] bg-[var(--accent)]" : "border-[var(--border-soft)] bg-white group-hover:border-[var(--accent)]/50",

            )}

          >

            <CheckCircle2 className={cn("size-3.5 text-white transition-opacity", isSelected ? "opacity-100" : "opacity-0")} />

          </div>

        </div>



        <div className="hidden size-11 items-center justify-center rounded-xl border border-[var(--accent)]/20 bg-[var(--accent)]/10 text-lg font-bold tracking-tighter text-[var(--accent)] transition-transform group-hover:scale-105 sm:flex uppercase">

          {customer.name.charAt(0)}

        </div>

      </div>



      <div className="flex min-w-0 flex-1 flex-col">

        <div className="mb-1.5 flex flex-wrap items-center gap-2">

          {customer.segment ? <RfmBadge segment={customer.segment} rfmScore={customer.rfmScore} showScore size="sm" /> : null}

          <span

            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${

              customer.tier === "vip"

                ? "border-[#32d74b]/20 bg-[rgba(50,215,75,0.15)] text-[#32d74b]"

                : "border-[var(--border-soft)] bg-[var(--fg-muted)]/10 text-[var(--fg-muted)]"

            }`}

          >

            {formatTierLabel(customer.tier)}

          </span>

          {group ? (

            <span

              className="rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase"

              style={{ backgroundColor: `${group.color}10`, color: group.color, borderColor: `${group.color}30` }}

            >

              {group.name}

            </span>

          ) : null}

          <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider", badge.class, badge.class.replace("bg-", "border-").replace("/10", "/20"))}>

            <span className="size-1.5 rounded-full" style={{ background: "currentColor" }} />

            {badge.label}

          </span>

        </div>



        <h3 className="mt-1 truncate text-[15px] font-black text-[var(--fg-base)] transition-colors group-hover:text-[var(--accent)]">

          {customer.name}

        </h3>



        <div className="mt-1.5 flex items-center gap-2 text-[13px] text-[var(--fg-muted)]">

          {contact ? (

            <span className="truncate rounded-md border border-[var(--border-soft)] bg-gray-100 px-2 py-0.5 font-medium text-[var(--fg-base)]">

              {contact.value}

            </span>

          ) : null}

          {tags.length > 0 ? <span className="h-1 w-1 rounded-full bg-gray-300" /> : null}

          {tags.slice(0, 3).map((tag) => (

            <span

              key={tag.id}

              className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold"

              style={{ backgroundColor: `${tag.color}15`, color: tag.color, border: `1px solid ${tag.color}30` }}

            >

              {tag.name}

            </span>

          ))}

        </div>

      </div>



      <div className="pointer-events-none flex w-full flex-col justify-center gap-2.5 rounded-[1.15rem] border border-[var(--border-soft)] bg-[rgba(246,250,244,0.72)] p-3.5 transition-colors group-hover:border-[var(--accent)]/20 group-hover:bg-white md:w-[240px] shrink-0">

        <div className="flex items-center justify-between border-b border-[var(--border-soft)] pb-1.5 text-[13px] font-medium">

          <span className="text-[var(--fg-muted)]">{vi.customers.list.totalSpent}</span>

          <span className="font-bold text-[var(--fg-base)] font-mono">{formatMoney(customer.totalSpentVnd || 0)}</span>

        </div>

        <div className="flex items-center justify-between border-b border-[var(--border-soft)] pb-1.5 text-[13px] font-medium">

          <span className="text-[var(--fg-muted)]">{vi.customers.list.wallet}</span>

          <span className="font-bold text-[var(--accent)] font-mono">{formatMoney(customer.balanceVnd || 0)}</span>

        </div>

        <div className="flex items-center justify-between text-[13px] font-medium">

          <span className="text-[var(--fg-muted)]">{vi.customers.list.debt}</span>

          <span className={cn("text-[14px] font-bold font-mono", customer.debtAmountVnd > 0 ? "text-[var(--danger)]" : "text-emerald-500")}>

            {customer.debtAmountVnd > 0 ? formatMoney(customer.debtAmountVnd) : vi.common.zeroMoney}

          </span>

        </div>

      </div>



      <div className="absolute right-4 top-4 z-10" onClick={(event) => event.stopPropagation()}>

        <ActionMenu

          items={[

            { label: vi.customers.list.actions.view, icon: <Eye className="size-4" />, onClick: () => onOpenCustomer(customer.id) },

            { label: vi.customers.list.actions.edit, icon: <Pencil className="size-4" />, onClick: () => onEditCustomer(customer) },

            { label: vi.customers.list.actions.debt, icon: <DollarSign className="size-4" />, onClick: () => onRenewCustomer(customer) },

            ...(customer.debtAmountVnd > 0

              ? [{ label: vi.customers.list.actions.collectAllDebt, icon: <DollarSign className="size-4" />, onClick: () => onClearDebt(customer.id) }]

              : []),

            { label: vi.customers.list.actions.delete, icon: <Trash2 className="size-4" />, onClick: () => onDeleteCustomer(customer), variant: "danger", dividerBefore: true },

          ]}

        />

      </div>



      <div className="absolute right-3 top-1/2 hidden size-8 -translate-y-1/2 translate-x-2 items-center justify-center rounded-full border border-[var(--border-soft)] bg-white text-[var(--accent)] opacity-0 shadow-[0_2px_10px_rgba(0,0,0,0.05)] transition-opacity group-hover:translate-x-0 group-hover:opacity-100 md:flex">

        <ChevronRight className="size-4" />

      </div>

    </div>

  );

});



export const CustomersPageList = React.memo(function CustomersPageList({

  customers,

  debouncedQuery,

  groups,

  isLoading,

  onClearDebt,

  onDeleteCustomer,

  onEditCustomer,

  onOpenCustomer,

  onPageIndexChange,

  onPageSizeChange,

  onRenewCustomer,

  onCreateFirstCustomer,

  onToggleSelect,

  onToggleSelectAll,

  pageCount,

  pageIndex,

  pageSize,

  selectedCount,

  selectedIds,

  totalElements,

  allFilteredSelected,

}: CustomersPageListProps) {

  const groupMap = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups]);

  const paginatedCustomers = useMemo(

    () => customers.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),

    [customers, pageIndex, pageSize]

  );



  return (

    <div className="relative flex min-h-0 w-full flex-col py-4">

      <div className="mb-4 flex items-center justify-between rounded-[1.2rem] border border-[var(--border-soft)] bg-[rgba(246,250,244,0.78)] p-3 shadow-sm">

        <label className="group flex cursor-pointer items-center gap-3 px-2">

          <div className="relative flex items-center justify-center">

            <input type="checkbox" className="peer sr-only" checked={allFilteredSelected} onChange={onToggleSelectAll} />

            <div className="flex h-5 w-5 items-center justify-center rounded-md border-2 border-[var(--border-soft)] transition-[background-color,border-color] group-hover:border-[var(--accent)]/50 peer-checked:border-[var(--accent)] peer-checked:bg-[var(--accent)]">

              <CheckCircle2 className={cn("size-3.5 text-white opacity-0 transition-opacity peer-checked:opacity-100")} />

            </div>

          </div>

          <span className="select-none text-[13px] font-bold text-[var(--fg-base)]">

            {selectedCount > 0 ? vi.customers.list.selectedCount(selectedCount) : vi.customers.list.selectAll}

          </span>

        </label>

        <span className="text-[12px] font-medium text-[var(--fg-muted)]">

          {vi.customers.list.total(totalElements)}

        </span>

      </div>



      <div data-testid="customer-list" className="flex min-h-[400px] flex-col gap-3">

        {isLoading ? (

          Array.from({ length: 5 }).map((_, index) => (

            <div key={index} className="animate-pulse flex flex-col gap-4 rounded-[1.5rem] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.82)] p-5 md:flex-row">

              <div className="h-5 w-5 shrink-0 rounded-md bg-gray-200" />

              <div className="flex-1 space-y-3">

                <div className="h-4 w-1/4 rounded bg-gray-200" />

                <div className="h-3 w-1/3 rounded bg-gray-200" />

              </div>

              <div className="w-full space-y-3 md:w-1/3">

                <div className="h-2 w-full rounded bg-gray-200" />

                <div className="h-3 w-1/2 rounded bg-gray-200" />

              </div>

            </div>

          ))

        ) : customers.length === 0 ? (

          <div className="flex flex-col items-center justify-center p-12 text-center">

            <Users className="mb-3 size-12 text-[var(--fg-muted)] opacity-50" />

            <h3 className="text-[15px] font-bold text-[var(--fg-base)]">{vi.customers.list.noCustomers}</h3>

            {debouncedQuery ? (

              <p className="mt-1 text-[13px] text-[var(--fg-muted)]">{vi.customers.list.tryDifferentSearch}</p>

            ) : (

              <Button variant="primary" className="mt-4" onClick={onCreateFirstCustomer}>

                {vi.customers.list.createFirst}

              </Button>

            )}

          </div>

        ) : (

          paginatedCustomers.map((customer) => {

            const isSelected = selectedIds.has(customer.id);

            return (

              <CustomerListRow

                key={customer.id}

                customer={customer}

                groupMap={groupMap}

                isSelected={isSelected}

                onClearDebt={onClearDebt}

                onDeleteCustomer={onDeleteCustomer}

                onEditCustomer={onEditCustomer}

                onOpenCustomer={onOpenCustomer}

                onRenewCustomer={onRenewCustomer}

                onToggleSelect={onToggleSelect}

              />

            );



          })

        )}

      </div>



      {(totalElements > 0 || isLoading) && (

        <div className="mt-6 flex flex-col items-center justify-between gap-4 rounded-[1.2rem] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.88)] p-4 sm:flex-row">

          <div className="flex w-full items-center gap-3 overflow-x-auto pb-1 sm:w-auto sm:pb-0">

            <span className="whitespace-nowrap text-[12px] font-bold uppercase tracking-wide text-[var(--fg-muted)]">{vi.customers.list.perPage}</span>

            <div className="flex rounded-lg border border-[var(--border-soft)] bg-gray-100 p-1">

              {[20, 50, 100].map((size) => (

                <button

                  key={size}
                  type="button"
                  aria-pressed={pageSize === size}

                  onClick={() => {

                    onPageSizeChange(size);

                    onPageIndexChange(0);

                  }}

                  className={cn(

                    "rounded-md px-3 py-1.5 text-[12px] font-bold transition-[background-color,color,box-shadow]",

                    pageSize === size ? "bg-white text-[var(--accent)] shadow-sm" : "text-[var(--fg-muted)] hover:bg-black/5 hover:text-[var(--fg-base)]"

                  )}

                >

                  {size}

                </button>

              ))}

            </div>

            <span className="hidden whitespace-nowrap border-l border-[var(--border-soft)] pl-3 text-[12px] font-medium text-[var(--fg-muted)] lg:inline">

              {vi.customers.list.results}: <strong className="text-[var(--fg-base)]">{pageIndex * pageSize + 1}–{Math.min((pageIndex + 1) * pageSize, totalElements)}</strong> / {totalElements}

            </span>

          </div>



          {pageCount > 1 && (

            <div className="flex items-center gap-1.5 rounded-xl border border-[var(--border-soft)] bg-gray-50 p-1">

              <button
                type="button"
                aria-label="Trang trước"

                onClick={() => onPageIndexChange(Math.max(0, pageIndex - 1))}

                disabled={pageIndex === 0 || isLoading}

                className="flex h-8 w-8 items-center justify-center rounded-lg font-bold text-[var(--fg-muted)] transition-[background-color,color,opacity] hover:bg-white hover:text-[var(--accent)] disabled:opacity-30 disabled:hover:bg-transparent"

              >

                <ChevronLeft className="size-4" />

              </button>

              {(() => {

                const buttons = [];

                const maxVisible = 5;

                let start = Math.max(0, pageIndex - Math.floor(maxVisible / 2));

                const end = Math.min(pageCount - 1, start + maxVisible - 1);

                if (end - start < maxVisible - 1) start = Math.max(0, end - maxVisible + 1);



                for (let index = start; index <= end; index++) {

                  buttons.push(

                    <button

                      key={index}
                      type="button"
                      aria-current={index === pageIndex ? "page" : undefined}

                      onClick={() => onPageIndexChange(index)}

                      className={cn(

                        "flex h-8 w-8 items-center justify-center rounded-lg border text-[13px] font-bold transition-[background-color,border-color,color,box-shadow]",

                        index === pageIndex

                          ? "border-[var(--accent)] bg-[var(--accent)] text-white shadow-sm"

                          : "border-[var(--border-soft)] bg-white text-[var(--fg-base)] hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/5"

                      )}

                    >

                      {index + 1}

                    </button>

                  );

                }

                return buttons;

              })()}

              <button
                type="button"
                aria-label="Trang sau"

                onClick={() => onPageIndexChange(Math.min(pageCount - 1, pageIndex + 1))}

                disabled={pageIndex >= pageCount - 1 || isLoading}

                className="flex h-8 w-8 items-center justify-center rounded-lg font-bold text-[var(--fg-muted)] transition-[background-color,color,opacity] hover:bg-white hover:text-[var(--accent)] disabled:opacity-30 disabled:hover:bg-transparent"

              >

                <ChevronRight className="size-4" />

              </button>

            </div>

          )}

        </div>

      )}

    </div>

  );

});
