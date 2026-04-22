import {
  AlertTriangle,
  ArrowRight,
  ArrowLeftRight,
  CheckCircle,
  Clock,
  CreditCard,
  Edit3,
  Loader2,
  Package,
  PlayCircle,
  Plus,
  RefreshCw,
  Trash2,
  User,
} from "lucide-react";
import { formatDateLabel, formatMoney } from "@/lib/utils";
import type { ViewActivityLog } from "@/shared/types/activity-logs";
import { vi } from "@/shared/messages/vi";

interface ActivityTimelineViewProps {
  logs: ViewActivityLog[];
  customerId?: string;
  orderId?: string;
  sourceAccountId?: string;
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
}

function getActionConfig(actionType: string) {
  switch (actionType) {
    case "CUSTOMER_CREATED":
      return { icon: User, color: "text-emerald-400", bg: "bg-emerald-500/20", label: vi.activityLogs.actionLabels.CUSTOMER_CREATED };
    case "ORDER_CREATED":
      return { icon: Plus, color: "text-indigo-400", bg: "bg-indigo-500/20", label: vi.activityLogs.actionLabels.ORDER_CREATED };
    case "ORDER_UPDATED":
      return { icon: RefreshCw, color: "text-blue-400", bg: "bg-blue-500/20", label: vi.activityLogs.actionLabels.ORDER_UPDATED };
    case "ORDER_DELETED":
      return { icon: Trash2, color: "text-red-400", bg: "bg-red-500/20", label: vi.activityLogs.actionLabels.ORDER_DELETED };
    case "PAYMENT_ADDED":
      return { icon: CreditCard, color: "text-emerald-400", bg: "bg-emerald-500/20", label: vi.activityLogs.actionLabels.PAYMENT_ADDED };
    case "INVENTORY_ASSIGNED":
      return { icon: Package, color: "text-purple-400", bg: "bg-purple-500/20", label: vi.activityLogs.actionLabels.INVENTORY_ASSIGNED };
    case "ALLOCATION_CONFIRMED":
      return { icon: PlayCircle, color: "text-purple-400", bg: "bg-purple-500/20", label: vi.activityLogs.badges.process };
    case "ALLOCATION_RELEASED":
      return { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/20", label: vi.activityLogs.badges.delete };
    case "RESERVED_NICK_ADDED":
      return { icon: Plus, color: "text-violet-400", bg: "bg-violet-500/20", label: vi.activityLogs.badges.create };
    case "RESERVED_NICK_REMOVED":
      return { icon: Trash2, color: "text-rose-400", bg: "bg-rose-500/20", label: vi.activityLogs.badges.delete };
    case "INVENTORY_KEY_CREATED":
      return { icon: Edit3, color: "text-cyan-400", bg: "bg-cyan-500/20", label: vi.activityLogs.actionLabels.PRODUCT_CREATED };
    case "SLOTS_RECALCULATED":
      return { icon: RefreshCw, color: "text-blue-400", bg: "bg-blue-500/20", label: vi.activityLogs.badges.process };
    case "WARRANTY_REASSIGNED":
      return { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/20", label: vi.activityLogs.actionLabels.WARRANTY_REASSIGNED };
    case "INVENTORY_STATUS_CHANGED":
      return { icon: CheckCircle, color: "text-slate-400", bg: "bg-slate-500/20", label: vi.activityLogs.badges.update };
    case "PREMIUM_MIGRATION_REQUEST_CREATED":
      return { icon: ArrowLeftRight, color: "text-cyan-400", bg: "bg-cyan-500/20", label: vi.activityLogs.badges.create };
    case "PREMIUM_MIGRATION_REQUEST_FAILED":
      return { icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/20", label: vi.activityLogs.badges.delete };
    default:
      return { icon: Clock, color: "text-slate-400", bg: "bg-slate-500/20", label: actionType };
  }
}

function renderLogDetails(log: ViewActivityLog) {
  if (!log.details || Object.keys(log.details).length === 0) {
    return null;
  }

  if (
    log.action_type === "WARRANTY_REASSIGNED" &&
    "old_account" in log.details &&
    "new_account" in log.details
  ) {
    return (
      <div className="mt-2 text-sm text-slate-300 bg-[#0B1120]/50 p-3 rounded-lg border border-slate-800/80">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="line-through text-slate-500 break-all">
              {String(log.details.old_account)}
            </span>
            <ArrowRight className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-emerald-400 font-medium break-all">
              {String(log.details.new_account)}
            </span>
          </div>
          {"reason" in log.details ? (
            <span className="text-slate-400 text-xs mt-0.5">
              {vi.activityLogs.details.prefixes.reason} {String(log.details.reason)}
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  if (log.action_type === "PAYMENT_ADDED") {
    return (
      <div className="mt-2 text-sm text-slate-300 bg-[#0B1120]/50 p-3 rounded-lg border border-slate-800/80">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
            <span className="text-slate-400">{vi.activityLogs.timeline.paymentLabel}</span>
            <span className="text-emerald-400 font-semibold">
              {formatMoney(Number(log.details.amount || 0))}
            </span>
          </div>
          {"note" in log.details ? (
            <div className="text-slate-500 text-xs mt-1 border-t border-slate-800 pt-1">
              {String(log.details.note)}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (log.action_type === "PREMIUM_MIGRATION_REQUEST_CREATED") {
    const details = log.details as Record<string, unknown>;

    return (
      <div className="mt-2 text-sm text-slate-300 bg-[#0B1120]/50 p-3 rounded-lg border border-slate-800/80">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="line-through text-slate-500 break-all">
              {String(details.source_account_email ?? "—")}
            </span>
            <ArrowRight className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="text-cyan-400 font-medium break-all">
              {String(details.target_account_email ?? "—")}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-slate-400">
            {"customer_name" in details ? (
              <span className="bg-slate-800/80 border border-slate-700 px-2 py-0.5 rounded-md">
                {vi.activityLogs.details.prefixes.customer} {String(details.customer_name)}
              </span>
            ) : null}
            {"service_type_id" in details ? (
              <span className="bg-slate-800/80 border border-slate-700 px-2 py-0.5 rounded-md">
                {vi.activityLogs.details.labels.service_type_id}: {String(details.service_type_id)}
              </span>
            ) : null}
            {"source_available_slots" in details ? (
              <span className="bg-slate-800/80 border border-slate-700 px-2 py-0.5 rounded-md">
                {vi.activityLogs.details.prefixes.source} {String(details.source_available_slots)}
              </span>
            ) : null}
            {"target_available_slots" in details ? (
              <span className="bg-slate-800/80 border border-slate-700 px-2 py-0.5 rounded-md">
                {vi.activityLogs.details.labels.target_available_slots}: {String(details.target_available_slots)}
              </span>
            ) : null}
          </div>
          {"reason" in details ? (
            <div className="text-slate-400 text-xs border-t border-slate-800 pt-1.5">
              {vi.activityLogs.details.prefixes.reason} {String(details.reason)}
            </div>
          ) : null}
          {"notes" in details && details.notes ? (
            <div className="text-slate-500 text-xs">
              {vi.activityLogs.details.prefixes.note} {String(details.notes)}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  const labelMap: Record<string, string> = {
    ...vi.activityLogs.details.labels,
  };

  return (
    <div className="mt-2 text-sm text-slate-300 bg-[#0B1120]/50 p-3 rounded-lg border border-slate-800/80">
      <ul className="space-y-1">
        {Object.entries(log.details).map(([key, value]) => {
          let displayValue = "—";
          if (value !== null && value !== undefined) {
            displayValue = typeof value === "object" ? JSON.stringify(value) : String(value);
          }

          const label = labelMap[key] || key.replace(/_/g, " ");

          return (
            <li key={key} className="flex justify-between items-start gap-4">
              <span className="text-slate-500 capitalize whitespace-nowrap">{label}:</span>
              <span className="text-slate-300 text-right break-words break-all">{displayValue}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ActivityTimelineView({
  logs,
  customerId,
  orderId,
  sourceAccountId,
  isLoading,
  isError,
  error,
  hasNextPage = false,
  isFetchingNextPage = false,
  onLoadMore,
}: ActivityTimelineViewProps) {
  if (isLoading && logs.length === 0) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
        {error instanceof Error ? error.message : vi.activityLogs.timeline.error}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-8 bg-slate-800/20 border border-slate-800 rounded-xl">
        <p className="text-slate-500 text-sm italic">{vi.activityLogs.timeline.empty}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative pl-4 space-y-6 before:absolute before:inset-y-0 before:left-6 before:w-px before:bg-slate-700">
        {logs.map((log) => {
          const config = getActionConfig(log.action_type);
          const Icon = config.icon;

          return (
            <div key={log.id} className="relative flex gap-4 pr-2">
              <div
                className={`mt-0.5 flex-none w-5 h-5 rounded-full flex items-center justify-center ring-4 ring-[#0B1120] ${config.bg} z-10 -ml-[11px]`}
              >
                <Icon className={`w-3 h-3 ${config.color}`} />
              </div>

              <div className="flex-1 bg-slate-800/40 border border-slate-700/50 rounded-xl p-3 shadow-sm hover:border-slate-600/50 transition-colors">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-medium text-slate-200 text-sm">{config.label}</span>
                  <span className="text-xs text-slate-500">{formatDateLabel(log.created_at)}</span>
                </div>

                <div className="flex gap-2 mb-2 text-xs text-slate-400 flex-wrap">
                  {!customerId && log.customers ? (
                    <span className="bg-slate-800/80 border border-slate-700 px-2 py-0.5 rounded-md truncate max-w-[200px]">
                      Khách: {log.customers.full_name}
                    </span>
                  ) : null}
                  {!orderId && log.orders ? (
                    <span className="bg-slate-800/80 border border-slate-700 px-2 py-0.5 rounded-md">
                      Đơn: #{log.orders.id.split("-")[0]}
                    </span>
                  ) : null}
                  {!sourceAccountId && log.source_accounts ? (
                    <span className="bg-slate-800/80 border border-slate-700 px-2 py-0.5 rounded-md truncate max-w-[200px]">
                      Kho: {log.source_accounts.email}
                    </span>
                  ) : null}
                </div>

                {renderLogDetails(log)}
              </div>
            </div>
          );
        })}
      </div>

      {hasNextPage && onLoadMore ? (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={isFetchingNextPage}
          className="w-full text-xs font-semibold py-2.5 rounded-lg border border-slate-700 bg-slate-800/30 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
        >
          {isFetchingNextPage ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            vi.activityLogs.timeline.loadMore
          )}
        </button>
      ) : null}
    </div>
  );
}
