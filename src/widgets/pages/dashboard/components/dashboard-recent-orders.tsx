"use client";

import Link from "next/link";
import { formatDateLabel } from "@/lib/utils";
import { getOrderDisplayStatus } from "../order-status";
import type { DashboardRecentOrder } from "../types";

type DashboardRecentOrdersProps = {
  recentOrders: DashboardRecentOrder[];
};

export function DashboardRecentOrders({ recentOrders }: DashboardRecentOrdersProps) {
  return (
    <section className="app-card overflow-hidden border border-[var(--border-soft)] shadow-[0_18px_44px_rgba(15,23,42,0.05)] transition-all hover:shadow-[0_22px_52px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-between border-b border-[var(--border-soft)] bg-[var(--bg-app)]/50 p-5 backdrop-blur-sm">
        <h3 className="text-[15px] font-bold tracking-tight text-[var(--fg-base)]">Đơn hàng cần xử lý</h3>
        <Link href="/orders" className="text-[12px] font-bold text-[var(--accent)] transition-opacity hover:underline active:opacity-70">
          Xem tất cả
        </Link>
      </div>

      {recentOrders.length === 0 ? (
        <div className="p-8 text-center text-[13px] text-[var(--fg-muted)]">
          Không có đơn hàng gần đây cho khoảng thời gian này.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] border-collapse text-left text-sm">
            <thead className="bg-[#f8f9fa] text-[var(--fg-muted)]">
              <tr className="border-b border-[var(--border-soft)]">
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest">Mã đơn</th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest">Khách hàng</th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest">Sản phẩm</th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest">Trạng thái</th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest">Ngày tạo</th>
                <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-widest">Chi tiết</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[var(--border-soft)] bg-white">
              {recentOrders.map((order) => {
                const statusConfig = getOrderDisplayStatus(order.status);

                return (
                  <tr key={order.id} className="transition-colors hover:bg-[var(--surface-light)]/50">
                    <td className="px-4 py-4">
                      <span className="whitespace-nowrap text-[13px] font-bold text-[var(--fg-base)]">{order.id}</span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 items-center justify-center rounded-full bg-[var(--border-soft)] text-[11px] font-bold text-[var(--fg-base)]">
                          {order.customerName.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="text-[13px] font-bold tracking-tight text-[var(--fg-base)]">{order.customerName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="whitespace-nowrap rounded-full bg-[var(--surface-strong)] px-2.5 py-1 text-[13px] font-medium text-[var(--fg-muted)]">
                        {order.productName}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className="inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider"
                        style={statusConfig.style}
                      >
                        <span
                          className={`size-2 rounded-full ${statusConfig.dotPulse ? "animate-pulse" : ""}`}
                          style={statusConfig.dotStyle}
                        />
                        {statusConfig.label}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-[13px] font-medium text-[var(--fg-muted)]">
                      {formatDateLabel(order.createdAt)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Link
                        href={`/orders/${order.id}`}
                        className="inline-flex rounded-lg border border-[var(--border-soft)] px-3 py-1.5 text-[12px] font-bold text-[var(--fg-base)] transition-colors hover:border-[var(--accent)]/30 hover:text-[var(--accent)]"
                      >
                        Xem
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
