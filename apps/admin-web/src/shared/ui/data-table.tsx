"use client";

import { memo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type Cell,
  type ColumnDef,
  type SortingState,
  type Row,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { vi } from "@/shared/messages/vi";

const PAGE_SIZE_OPTIONS = [20, 50, 100, 500];

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: TData) => void;
  onRowContextMenu?: (e: React.MouseEvent, row: TData) => void;
  defaultPageSize?: number;
  serverSide?: boolean;
  pageCount?: number;
  pageIndex?: number;
  onPaginationChange?: (pageIndex: number, pageSize: number) => void;
  totalElements?: number;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  isLoading,
  emptyMessage = vi.common.noData,
  onRowClick,
  onRowContextMenu,
  defaultPageSize = 20,
  serverSide = false,
  pageCount: controlledPageCount,
  pageIndex: controlledPageIndex,
  onPaginationChange,
  totalElements,
}: DataTableProps<TData, TValue>) {
  const [internalPageSize, setInternalPageSize] = useState(defaultPageSize);
  const [internalPageIndex, setInternalPageIndex] = useState(0);
  const [sorting, setSorting] = useState<SortingState>([]);

  const pageSize = internalPageSize;
  const pageIndex = serverSide && controlledPageIndex !== undefined ? controlledPageIndex : internalPageIndex;

  const handlePaginationChange = (
    updater: import("@tanstack/react-table").Updater<import("@tanstack/react-table").PaginationState>,
  ) => {
    const next = typeof updater === "function" ? updater({ pageSize, pageIndex }) : updater;

    setInternalPageSize(next.pageSize);
    if (serverSide && onPaginationChange) {
      onPaginationChange(next.pageIndex, next.pageSize);
    } else {
      setInternalPageIndex(next.pageIndex);
    }
  };

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table exposes unstable helpers here by design.
  const table = useReactTable({
    data,
    columns,
    pageCount: serverSide ? controlledPageCount : undefined,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { pagination: { pageSize, pageIndex }, sorting },
    manualPagination: serverSide,
    onSortingChange: setSorting,
    onPaginationChange: handlePaginationChange,
  });

  const computedPageCount = serverSide ? controlledPageCount ?? 1 : table.getPageCount();
  const actualTotal = serverSide && totalElements !== undefined ? totalElements : data.length;
  const from = actualTotal === 0 ? 0 : pageIndex * pageSize + 1;
  const to = actualTotal === 0 ? 0 : Math.min((pageIndex + 1) * pageSize, actualTotal);

  const renderPageButtons = () => {
    const buttons: React.ReactNode[] = [];
    const maxVisible = 5;
    let start = Math.max(0, pageIndex - Math.floor(maxVisible / 2));
    const end = Math.min(computedPageCount - 1, start + maxVisible - 1);

    if (end - start < maxVisible - 1) {
      start = Math.max(0, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i += 1) {
      buttons.push(
        <button
          key={i}
          type="button"
          onClick={() => handlePaginationChange({ pageSize, pageIndex: i })}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-[0.9rem] border text-[12px] font-bold transition-all",
            i === pageIndex
              ? "border-[var(--accent)] bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] text-white shadow-[0_10px_20px_rgba(var(--accent-rgb),0.18)]"
              : "border-[var(--border-soft)] bg-[rgba(255,255,255,0.92)] text-[var(--fg-base)] hover:border-[var(--accent)]/35 hover:bg-white",
          )}
        >
          {i + 1}
        </button>,
      );
    }

    return buttons;
  };

  const SkeletonRow = () => (
    <tr className="animate-pulse border-b border-[var(--border-soft)]">
      {columns.map((_, idx) => (
        <td key={idx} className="px-4 py-4">
          <div className="flex items-center gap-3">
            {idx === 0 ? <div className="h-5 w-5 shrink-0 rounded bg-[var(--border-soft)]" /> : null}
            <div className={cn("h-4 rounded bg-[var(--border-soft)]", idx === 0 ? "w-1/2" : "w-3/4")} />
          </div>
        </td>
      ))}
    </tr>
  );

  return (
    <div className="flex w-full min-h-0 flex-col">
      <div className="custom-scrollbar flex-1 overflow-auto max-h-[calc(100vh-280px)]">
        <table className="relative w-full min-w-[800px] border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-[rgba(255,255,255,0.92)] text-[var(--fg-muted)] backdrop-blur">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-[var(--border-soft)]">
                {headerGroup.headers.map((header) => {
                  const isSortable = header.column.getCanSort();
                  const sortDirection = header.column.getIsSorted();

                  return (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className={cn(
                        "h-11 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em] align-middle text-[var(--fg-muted)]",
                        isSortable && "cursor-pointer transition-colors hover:bg-[var(--surface-light)]",
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}

                        {isSortable ? (
                          <div className="flex w-4 justify-center">
                            {sortDirection === "asc" ? (
                              <ArrowUp className="size-3 text-[var(--accent)]" />
                            ) : sortDirection === "desc" ? (
                              <ArrowDown className="size-3 text-[var(--accent)]" />
                            ) : (
                              <ArrowUpDown className="size-3 opacity-30 transition-opacity group-hover/th:opacity-100" />
                            )}
                          </div>
                        ) : null}
                      </div>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-[var(--border-soft)] bg-[rgba(255,255,255,0.9)] tabular-nums">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, index) => <SkeletonRow key={`skeleton-${index}`} />)
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-16">
                  <div className="empty-state mx-auto max-w-lg">
                    <div className="rounded-full border border-[var(--border-soft)] bg-white/80 p-3 text-[var(--fg-muted)] shadow-sm">
                      <ArrowUpDown className="size-5" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-[15px] font-bold text-[var(--fg-base)]">{vi.common.noData}</h3>
                      <p className="text-[13px] text-[var(--fg-muted)]">{emptyMessage}</p>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <MemoizedRow
                  key={row.id}
                  row={row as Row<unknown>}
                  onRowClick={onRowClick as ((row: unknown) => void) | undefined}
                  onRowContextMenu={onRowContextMenu as ((e: React.MouseEvent, row: unknown) => void) | undefined}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {(actualTotal > 0 || isLoading) ? (
        <div className="flex flex-col gap-3 border-t border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,250,244,0.9))] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-medium text-[var(--fg-muted)]">{vi.common.rowsPerPage}</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const newSize = Number(e.target.value);
                handlePaginationChange({ pageSize: newSize, pageIndex: 0 });
              }}
              className="h-8 rounded-[0.9rem] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.92)] px-2 pr-6 text-[12px] font-bold text-[var(--fg-base)] outline-none transition-colors hover:border-[var(--accent)]/35 appearance-none"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 6px center",
              }}
            >
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option} {vi.common.rows}
                  </option>
                ))}
              </select>
            <span className="text-[12px] font-medium text-[var(--fg-muted)]">
              <span className="font-bold text-[var(--fg-base)]">
                {isLoading ? "..." : from}–{isLoading ? "..." : to}
              </span>{" "}
              {vi.common.of}{" "}
              <span className="font-bold text-[var(--fg-base)]">
                {isLoading ? "..." : actualTotal}
              </span>{" "}
              {vi.common.results}
            </span>
          </div>

          {computedPageCount > 1 ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handlePaginationChange({ pageSize, pageIndex: Math.max(0, pageIndex - 1) })}
                disabled={pageIndex === 0 || isLoading}
                className="flex h-8 w-8 items-center justify-center rounded-[0.9rem] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.92)] text-[var(--fg-muted)] transition-all hover:border-[var(--accent)]/35 hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronLeft className="size-4" />
              </button>
              {renderPageButtons()}
              <button
                type="button"
                onClick={() => handlePaginationChange({ pageSize, pageIndex: Math.min(computedPageCount - 1, pageIndex + 1) })}
                disabled={pageIndex >= computedPageCount - 1 || isLoading}
                className="flex h-8 w-8 items-center justify-center rounded-[0.9rem] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.92)] text-[var(--fg-muted)] transition-all hover:border-[var(--accent)]/35 hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

  const MemoizedRow = memo(function MemoizedRow({
  row,
  onRowClick,
  onRowContextMenu,
}: {
  row: Row<unknown>;
  onRowClick?: (row: unknown) => void;
  onRowContextMenu?: (e: React.MouseEvent, row: unknown) => void;
}) {
  const isInteractiveTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    return target.closest("button,a,input,select,textarea,[role='button'],[data-no-row-click]") !== null;
  };

  return (
    <tr
      role={onRowClick ? "button" : undefined}
      tabIndex={onRowClick ? 0 : undefined}
      onClick={(event) => {
        if (isInteractiveTarget(event.target)) {
          return;
        }

        onRowClick?.(row.original);
      }}
      onKeyDown={(event) => {
        if (!onRowClick) {
          return;
        }

        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onRowClick(row.original);
        }
      }}
      onContextMenu={(e) => onRowContextMenu?.(e, row.original)}
      className={cn(
        "group transition-colors duration-150",
        onRowClick ? "cursor-pointer hover:bg-[var(--surface-light)]" : "hover:bg-[var(--surface-light)]",
      )}
    >
      {row.getVisibleCells().map((cell) => (
        <MemoizedCell key={cell.id} cell={cell as Cell<unknown, unknown>} />
      ))}
    </tr>
  );
});

const MemoizedCell = memo(function MemoizedCell({ cell }: { cell: Cell<unknown, unknown> }) {
  return (
    <td className="px-4 py-3.5 align-middle text-[13px] font-medium tabular-nums text-[var(--fg-base)]">
      {flexRender(cell.column.columnDef.cell, cell.getContext())}
    </td>
  );
});
