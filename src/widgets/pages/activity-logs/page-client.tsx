"use client";

import { useState, useEffect, useMemo } from "react";
import type { MouseEvent, ReactElement } from "react";
import dynamic from "next/dynamic";
import type { ColumnDef } from "@tanstack/react-table";
import { useActivityLogs } from "@/widgets/pages/activity-logs/hooks/use-activity-logs";
import { AppLayout } from "@/widgets/layout/app-layout";
import { PageContainer } from "@/shared/ui/page-layout";
import { Activity, Clock, Database, PlayCircle, PlusCircle, Trash2, Edit3, User, Server, Search } from "lucide-react";
import { useContextMenu } from "@/shared/ui/context-menu";
import { Input } from "@/shared/ui/input";
import { formatDateLabel, formatMoney } from "@/lib/utils";

// Helper to translate and style action types
function getActionBadge(type?: string | null) {
  if (!type) return { label: "N/A", color: "bg-gray-100 text-gray-700 border-gray-200", icon: <Activity className="size-3.5 mr-1" /> };
  const t = type.toUpperCase();
  if (t.includes("CREATE")) return { label: "Tạo mới", color: "bg-green-100 text-green-700 border-green-200", icon: <PlusCircle className="size-3.5 mr-1" /> };
  if (t.includes("UPDATE")) return { label: "Cập nhật", color: "bg-blue-100 text-blue-700 border-blue-200", icon: <Edit3 className="size-3.5 mr-1" /> };
  if (t.includes("DELETE")) return { label: "Xóa bỏ", color: "bg-red-100 text-red-700 border-red-200", icon: <Trash2 className="size-3.5 mr-1" /> };
  if (t.includes("ALLOCATE") || t.includes("PROCESS")) return { label: "Xử lý", color: "bg-purple-100 text-purple-700 border-purple-200", icon: <PlayCircle className="size-3.5 mr-1" /> };
  return { label: type, color: "bg-gray-100 text-gray-700 border-gray-200", icon: <Activity className="size-3.5 mr-1" /> };
}

type LogRow = {
  created_at?: string;
  action_type?: string;
  customers?: { full_name: string } | null;
  orders?: { id: string } | null;
  inventory_accounts?: { email: string } | null;
  details?: Record<string, unknown> | null;
};

type DynamicDataTableComponent = <TData, TValue>(props: {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: TData) => void;
  onRowContextMenu?: (e: MouseEvent, row: TData) => void;
  defaultPageSize?: number;
  serverSide?: boolean;
  pageCount?: number;
  pageIndex?: number;
  onPaginationChange?: (pageIndex: number, pageSize: number) => void;
  totalElements?: number;
}) => ReactElement;

const DataTable = dynamic(
  () => import("@/shared/ui/data-table").then((m) => ({ default: m.DataTable })),
  {
    ssr: false,
    loading: () => (
      <div className="p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="animate-pulse rounded-2xl border border-[var(--border-soft)] bg-white/50 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="h-4 w-24 rounded bg-gray-200" />
              <div className="h-4 w-36 rounded bg-gray-200" />
              <div className="h-4 w-40 rounded bg-gray-200" />
            </div>
          </div>
        ))}
      </div>
    ),
  }
) as unknown as DynamicDataTableComponent;

export default function ActivityLogsPage() {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [actionTypeFilter, setActionTypeFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { openContextMenu, ContextMenuRender } = useContextMenu();

  const { data: pageData, isLoading, isFetching } = useActivityLogs({
    page: pageIndex + 1,
    limit: pageSize,
    search: debouncedQuery || undefined,
    actionType: actionTypeFilter || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined
  });

  const logs = pageData?.data || [];
  const meta = pageData?.meta || { count: 0, totalPages: 0 };

  // Debounce search input 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Reset page index on filter change handler directly to avoid setState in useEffect

  const columns = useMemo<ColumnDef<LogRow>[]>(() => [
    {
      id: "created_at",
      header: "Thời gian",
      cell: ({ row }: { row: { original: LogRow } }) => {
        const data = row.original;
        return (
          <div className="flex items-center gap-2 text-[13px] text-[var(--fg-muted)]">
            <Clock className="size-3.5 text-gray-400" />
            {data.created_at ? formatDateLabel(data.created_at) : "N/A"}
          </div>
        );
      },
    },
    {
      id: "action_type",
      header: "Thao tác",
      cell: ({ row }: { row: { original: LogRow } }) => {
        const data = row.original;
        const badge = getActionBadge(data.action_type);
        return (
          <div className="flex flex-col gap-1">
            <span className={`inline-flex items-center w-fit px-2 py-0.5 rounded-md border text-[11px] font-bold ${badge.color}`}>
              {badge.icon}
              {badge.label}
            </span>
            <span className="text-[10px] text-gray-400 font-mono">{data.action_type}</span>
          </div>
        );
      },
    },
    {
      id: "target",
      header: "Đối tượng",
      cell: ({ row }: { row: { original: LogRow } }) => {
        const data = row.original;
        return (
          <div className="flex flex-col gap-1.5 text-[13px]">
            {data.customers && (
              <div className="flex items-center gap-1.5 text-blue-600 bg-blue-50 w-fit px-2 py-0.5 rounded-md">
                <User className="size-3" />
                <span className="font-semibold">{data.customers.full_name}</span>
              </div>
            )}
            {data.orders && (
              <div className="flex items-center gap-1.5 text-orange-600 bg-orange-50 w-fit px-2 py-0.5 rounded-md">
                <Database className="size-3" />
                <span className="font-mono font-medium">Order #{data.orders.id.slice(0, 6)}</span>
              </div>
            )}
            {data.inventory_accounts && (
              <div className="flex items-center gap-1.5 text-purple-600 bg-purple-50 w-fit px-2 py-0.5 rounded-md">
                <Server className="size-3" />
                <span className="font-medium">{data.inventory_accounts.email}</span>
              </div>
            )}
            {!data.customers && !data.orders && !data.inventory_accounts && (
              <span className="text-gray-400 italic">Hệ thống</span>
            )}
          </div>
        );
      },
    },
    {
      id: "details",
      header: "Chi tiết Data",
      cell: ({ row }: { row: { original: LogRow } }) => {
        const data = row.original;
        if (!data.details || Object.keys(data.details).length === 0) {
          return <span className="text-gray-400 italic text-[11px]">Không có dữ liệu chi tiết</span>;
        }

        // Vietnamese labels for common detail keys
        const labelMap: Record<string, string> = {
          action: 'Hành động', changes: 'Thay đổi', email: 'Email', provider: 'NCC',
          max_slots: 'Slot tối đa', used_slots: 'Slot đã dùng', expires_at: 'Hạn',
          purchase_cost_vnd: 'Giá mua', purchase_date: 'Ngày mua', purchase_source: 'Nguồn',
          products: 'Sản phẩm', credentials: 'Credentials', password: 'Mật khẩu',
          note: 'Ghi chú', reason: 'Lý do', status: 'Trạng thái', amount: 'Số tiền',
          title: 'Tiêu đề', type: 'Loại', event_id: 'Event ID', order_id: 'Đơn hàng',
          order_item_id: 'Order Item ID', method: 'Phương thức', updates: 'Cập nhật',
          total_amount_vnd: 'Tổng tiền', payment_method: 'PTTT', items_count: 'Số mặt hàng',
          old_account: 'TK cũ', new_account: 'TK mới', customer_id: 'Khách hàng',
          source_account_id: 'TK kho', nick: 'Nick', slot: 'Slot',
        };

        // Smart value formatter: handles objects, dates, currency
        const formatValue = (key: string, val: unknown): string => {
          if (val === null || val === undefined) return '—';
          if (typeof val === 'object') {
            try { return JSON.stringify(val, null, 0); } catch { return '[complex data]'; }
          }
          // VND currency for amount/price/cost keys
          if (typeof val === 'number' && /amount|price|cost/i.test(key)) {
            return formatMoney(val);
          }
          return String(val);
        };

        return (
          <div className="max-w-[400px] max-h-[120px] overflow-auto bg-slate-50 border border-slate-100 rounded-lg p-2 custom-scrollbar">
            {data.action_type === 'WARRANTY_REASSIGNED' && data.details.old_account && data.details.new_account ? (
              <div className="flex flex-col gap-1.5 text-[12px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="line-through text-slate-500 break-all">{String(data.details.old_account)}</span>
                  <span className="text-emerald-500 font-bold break-all">→ {String(data.details.new_account)}</span>
                </div>
                {'reason' in data.details && <span className="text-slate-500 text-[11px] mt-0.5">Lý do: {String(data.details.reason)}</span>}
              </div>
            ) : data.action_type === 'PAYMENT_ADDED' ? (
              <div className="flex flex-col gap-1 text-[12px]">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Đã thanh toán:</span>
                  <span className="text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">{formatMoney(Number(data.details.amount || 0))}</span>
                </div>
                {'note' in data.details && (
                  <div className="text-slate-500 text-[11px] mt-1 italic border-t border-slate-200 pt-1">{String(data.details.note)}</div>
                )}
              </div>
            ) : (
              <ul className="space-y-1">
                {Object.entries(data.details).map(([key, val]) => (
                  <li key={key} className="flex justify-between items-start gap-4 text-[11px] font-mono">
                    <span className="text-slate-500 capitalize whitespace-nowrap">{labelMap[key] || key.replace(/_/g, ' ')}:</span>
                    <span className="text-slate-700 text-right font-semibold break-all">{formatValue(key, val)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      },
    },
  ], []);

  return (
    <AppLayout>
      <ContextMenuRender />
      <PageContainer className="relative pb-20">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-2 mt-2">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-[var(--fg-base)] flex items-center gap-3">
              <Activity className="size-8 text-[var(--accent)]" /> 
              Nhật ký hệ thống
            </h1>
            <p className="text-[15px] text-[var(--fg-muted)] mt-2 tracking-wide">
              Theo dõi lịch sử toàn bộ các thao tác thay đổi dữ liệu của nhân sự thông qua truy vấn JSONB Deep-Search.
            </p>
          </div>
        </div>

        {/* Filter Bar (Sticky Smart Filters) */}
        <div className="sticky top-20 z-40 bg-[var(--bg-app)]/80 backdrop-blur-md pb-4 pt-2 -mx-4 px-4">
          <div className="glass-card p-4 rounded-ios shadow-sm border border-[var(--border-soft)] bg-white">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[240px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-muted)] size-4" />
                <Input
                  className="pl-9"
                  placeholder="Tìm kiếm nội dung (ví dụ: email, id đơn, hoặc tên khách hàng)..."
                  autoComplete="off"
                  name="search-logs"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPageIndex(0); }}
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={actionTypeFilter}
                  onChange={(e) => { setActionTypeFilter(e.target.value); setPageIndex(0); }}
                  className="bg-white border border-[var(--border-soft)] rounded-xl text-[13px] font-bold text-[var(--fg-base)] px-4 py-2 focus-visible:ring-2 focus-visible:ring-[var(--ring)] outline-none min-w-[140px] cursor-pointer hover:border-[var(--accent)]/40 transition-colors"
                >
                  <option value="">Tất cả thao tác</option>
                  <option value="CUSTOMER_CREATED">Tạo khách hàng</option>
                  <option value="CUSTOMER_UPDATED">Cập nhật khách hàng</option>
                  <option value="CUSTOMER_DELETED">Xóa khách hàng</option>
                  <option value="ORDER_CREATED">Tạo đơn hàng</option>
                  <option value="ORDER_UPDATED">Cập nhật đơn hàng</option>
                  <option value="ORDER_DELETED">Xóa đơn hàng</option>
                  <option value="ORDER_CANCELLED">Hủy đơn hàng</option>
                  <option value="PAYMENT_ADDED">Thanh toán (PAYMENT_ADDED)</option>
                  <option value="INVENTORY_ASSIGNED">Cấp phát tài khoản</option>
                  <option value="WARRANTY_REASSIGNED">Bảo hành tài khoản</option>
                  <option value="PRODUCT_CREATED">Tạo sản phẩm</option>
                  <option value="PRODUCT_UPDATED">Cập nhật sản phẩm</option>
                  <option value="PRODUCT_DELETED">Xóa sản phẩm</option>
                  <option value="CALENDAR_EVENT_CREATED">Tạo lịch hẹn/nhắc nhở</option>
                  <option value="CALENDAR_EVENT_UPDATED">Cập nhật sự kiện lịch</option>
                  <option value="CALENDAR_EVENT_DELETED">Xóa sự kiện lịch</option>
                  <option value="SYSTEM_SETTINGS_UPDATED">Cập nhật thiết lập hệ thống</option>
                  <option value="PAYMENT_SOURCE_CREATED">Tạo nguồn thanh toán</option>
                  <option value="PAYMENT_SOURCE_UPDATED">Cập nhật nguồn thanh toán</option>
                  <option value="PAYMENT_SOURCE_DELETED">Xóa nguồn thanh toán</option>
                </select>
                <div className="flex bg-white border border-[var(--border-soft)] rounded-xl overflow-hidden hover:border-[var(--accent)]/40 transition-colors focus-within:ring-2 focus-within:ring-[var(--ring)]">
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => { setStartDate(e.target.value); setPageIndex(0); }}
                    className="text-[13px] font-bold text-[var(--fg-base)] px-3 py-2 outline-none border-r border-[var(--border-soft)] max-w-[120px] bg-transparent"
                    title="Từ ngày"
                  />
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => { setEndDate(e.target.value); setPageIndex(0); }}
                    className="text-[13px] font-bold text-[var(--fg-base)] px-3 py-2 outline-none max-w-[120px] bg-transparent"
                    title="Đến ngày"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={`bg-white rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.04)] border border-[var(--border-soft)] overflow-hidden transition-all duration-300 ${isFetching && !isLoading ? "opacity-60 pointer-events-none" : ""}`}>
          <div className="p-1">
            <DataTable
              serverSide={true}
              onRowContextMenu={(e, row) => {
                const log = row as LogRow;
                openContextMenu(e, [
                  { label: "Sao chép dữ liệu", icon: <Database className="size-4" />, onClick: () => navigator.clipboard.writeText(JSON.stringify(log.details || {}, null, 2)) },
                ]);
              }}
              isLoading={isLoading}
              pageCount={meta.totalPages}
              pageIndex={pageIndex}
              totalElements={meta.count}
              onPaginationChange={(newPageIndex, newPageSize) => {
                setPageIndex(newPageIndex);
                setPageSize(newPageSize);
              }}
              columns={columns}
              data={logs}
              emptyMessage={isLoading ? "Đang tải dữ liệu hệ thống..." : "Trống: Không tìm thấy thao tác nào khớp với bộ lọc."}
            />
          </div>
        </div>
      </PageContainer>
    </AppLayout>
  );
}
