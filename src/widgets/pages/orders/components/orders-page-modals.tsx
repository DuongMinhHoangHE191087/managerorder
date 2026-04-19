"use client";

import dynamic from "next/dynamic";
import { Printer, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { appToast } from "@/shared/lib/toast";
import { formatDateShort } from "@/lib/utils";
import { Button } from "@/shared/ui/button";
import { Modal } from "@/shared/ui/modal";
import { Input } from "@/shared/ui/input";
import { queryKeys } from "@/shared/lib/react-query/query-keys";
import type { OrderRow } from "@/widgets/pages/orders/components/orders-table";
import type { OrderWithItems } from "@/lib/supabase/repositories/orders.repo";

const OrderDetailModal = dynamic(
  () => import("@/widgets/pages/orders/components/order-detail-modal").then((m) => ({ default: m.OrderDetailModal })),
  { ssr: false }
);
const PaymentModal = dynamic(
  () => import("@/widgets/pages/orders/components/payment-modal").then((m) => ({ default: m.PaymentModal })),
  { ssr: false }
);
const InvoiceTemplate = dynamic(
  () => import("@/widgets/pages/orders/components/invoice-template").then((m) => ({ default: m.InvoiceTemplate })),
  { ssr: false }
);
const SlideOverDrawer = dynamic(
  () => import("@/shared/ui/slide-over-drawer").then((m) => ({ default: m.SlideOverDrawer })),
  { ssr: false }
);

type OrdersPageModalsProps = {
  deletingOrder: OrderRow | null;
  isBatchDeleting: boolean;
  isDrawerOpen: boolean;
  isPaymentModalOpen: boolean;
  isPrintModalOpen: boolean;
  isRenewalDrawerOpen: boolean;
  onBatchDeleteConfirm: () => void;
  onCloseBatchDelete: () => void;
  onCloseDelete: () => void;
  onCloseDrawer: () => void;
  onClosePayment: () => void;
  onClosePrint: () => void;
  onCloseRenewal: () => void;
  onDeleteConfirm: () => void;
  onPaymentSuccess: () => void;
  onRenewSubmit: (formData: FormData) => void;
  onStatusChange: (orderId: string, status: string) => void;
  onPaymentClick: () => void;
  onRenewClick: () => void;
  onPrintClick: () => void;
  onDeleteClick: () => void;
  payingOrder: OrderRow | null;
  printingOrder: OrderWithItems | null;
  renewingOrder: OrderRow | null;
  selectedOrder: OrderRow | null;
  selectedOrderIdsCount: number;
  showBatchDeleteConfirm: boolean;
};

function PrintInvoiceModal({ isOpen, onClose, order }: { isOpen: boolean; onClose: () => void; order: OrderWithItems | null }) {
  const handlePrintNow = () => {
    const printContent = document.getElementById("invoice-print-area");
    if (!printContent) return;

    const windowObject = window.open("", "PrintWindow", "width=1000,height=800");
    if (!windowObject) return;

    windowObject.document.writeln("<html><head><title>Print Invoice</title>");
    windowObject.document.writeln(`<style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 14px; color: #1e293b; padding: 24px; }
      table { width: 100%; border-collapse: collapse; margin: 16px 0; }
      th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }
      th { background: #f1f5f9; font-weight: 600; }
      h1, h2, h3, h4 { margin: 8px 0; }
      .text-right { text-align: right; }
      .font-bold { font-weight: 700; }
      .text-sm { font-size: 13px; }
      .text-xs { font-size: 11px; }
      .mt-4 { margin-top: 16px; }
      .mb-2 { margin-bottom: 8px; }
      .border-t { border-top: 1px solid #e2e8f0; }
      @media print { body { padding: 0; } }
    </style>`);
    windowObject.document.writeln("</head><body>");
    windowObject.document.writeln(printContent.innerHTML);
    windowObject.document.writeln("</body></html>");
    windowObject.document.close();
    windowObject.focus();
    setTimeout(() => {
      windowObject.print();
      windowObject.close();
    }, 500);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="In Hóa Đơn"
      size="lg"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Đóng
          </Button>
          <Button variant="primary" onClick={handlePrintNow} className="flex items-center gap-2">
            <Printer className="size-4" /> In ngay
          </Button>
        </div>
      }
    >
      <div className="max-h-[70vh] rounded-xl bg-gray-100 p-4 overflow-y-auto">
        {order ? (
          <div id="invoice-print-area">
            <InvoiceTemplate order={order} />
          </div>
        ) : (
          <div className="flex items-center justify-center p-12 text-[var(--fg-muted)]">
            Đang tải dữ liệu...
          </div>
        )}
      </div>
    </Modal>
  );
}

function RenewalDrawer({
  isOpen,
  onClose,
  onSubmit,
  order,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
  order: OrderRow | null;
}) {
  return (
    <SlideOverDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={`Gia hạn đơn hàng ${order?.order_code || order?.id?.slice(0, 8) || ""}`}
      width="max-w-md"
    >
      {order && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(new FormData(event.currentTarget));
          }}
          className="space-y-6"
        >
          <div className="app-card p-5">
            <p className="mb-2 text-[13px] text-[var(--fg-muted)]">
              Đơn hàng <strong className="font-mono text-[var(--fg-base)]">#{order.order_code || order.id.slice(0, 8)}</strong>
            </p>
            <p className="text-[13px] text-[var(--fg-muted)]">
              Ngày HH hiện tại:{" "}
              <strong className="text-[var(--accent)]">
                {order.expires_at ? formatDateShort(order.expires_at) : "Chưa thiết lập"}
              </strong>
            </p>
          </div>
          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
              Ngày hết hạn mới *
            </label>
            <Input
              name="expires_at"
              type="date"
              defaultValue={order.expires_at ? new Date(order.expires_at).toISOString().split("T")[0] : ""}
              required
            />
          </div>
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              Hủy
            </Button>
            <Button type="submit" variant="primary" className="flex-1">
              Cập nhật Gia hạn
            </Button>
          </div>
        </form>
      )}
    </SlideOverDrawer>
  );
}

export function OrdersPageModals({
  deletingOrder,
  isBatchDeleting,
  isDrawerOpen,
  isPaymentModalOpen,
  isPrintModalOpen,
  isRenewalDrawerOpen,
  onBatchDeleteConfirm,
  onCloseBatchDelete,
  onCloseDelete,
  onCloseDrawer,
  onClosePayment,
  onClosePrint,
  onCloseRenewal,
  onDeleteConfirm,
  onPaymentSuccess,
  onRenewSubmit,
  onStatusChange,
  onPaymentClick,
  onRenewClick,
  onPrintClick,
  onDeleteClick,
  payingOrder,
  printingOrder,
  renewingOrder,
  selectedOrder,
  selectedOrderIdsCount,
  showBatchDeleteConfirm,
}: OrdersPageModalsProps) {
  const queryClient = useQueryClient();

  const paymentSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.orders });
    onPaymentSuccess();
    appToast.success("Thanh toán đã được cập nhật!");
  }, [onPaymentSuccess, queryClient]);

  return (
    <>
      <OrderDetailModal
        isOpen={isDrawerOpen}
        onClose={onCloseDrawer}
        order={selectedOrder}
        onPaymentClick={onPaymentClick}
        onRenewClick={onRenewClick}
        onPrintClick={onPrintClick}
        onDeleteClick={onDeleteClick}
        onStatusChange={onStatusChange}
      />

      <RenewalDrawer isOpen={isRenewalDrawerOpen} onClose={onCloseRenewal} onSubmit={onRenewSubmit} order={renewingOrder} />

      <PrintInvoiceModal isOpen={isPrintModalOpen} onClose={onClosePrint} order={printingOrder} />

      <Modal
        isOpen={!!deletingOrder}
        onClose={onCloseDelete}
        title="Xác nhận xóa đơn hàng"
        size="sm"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={onCloseDelete}>
              Hủy
            </Button>
            <Button variant="primary" onClick={onDeleteConfirm} className="!bg-[var(--danger)] !shadow-none hover:!bg-[var(--danger)]">
              Xóa vĩnh viễn
            </Button>
          </div>
        }
      >
        <div className="py-4 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-[var(--danger)]/10">
            <Trash2 className="size-8 text-[var(--danger)]" />
          </div>
          <p className="mb-2 text-[15px] font-bold text-[var(--fg-base)]">Bạn chắc chắn muốn xóa?</p>
          <p className="text-[13px] text-[var(--fg-muted)]">
            Đơn hàng{" "}
            <span className="font-mono font-bold text-[var(--fg-base)]">
              &ldquo;{deletingOrder?.order_code || deletingOrder?.id?.slice(0, 8)}&rdquo;
            </span>{" "}
            sẽ bị xóa vĩnh viễn.
          </p>
        </div>
      </Modal>

      {payingOrder ? (
        <PaymentModal
          key={`${payingOrder.id}-${isPaymentModalOpen ? "open" : "closed"}`}
          isOpen={isPaymentModalOpen}
          onClose={onClosePayment}
          orderId={payingOrder.id}
          totalAmountVnd={payingOrder.total_amount_vnd}
          totalPaid={payingOrder.total_paid || 0}
          currentPaymentTerms={payingOrder.payment_terms ?? payingOrder.payment_method}
          currentSourceId={payingOrder.payment_source_id}
          onSuccess={paymentSuccess}
        />
      ) : null}

      <Modal
        isOpen={showBatchDeleteConfirm}
        onClose={onCloseBatchDelete}
        title="Xác nhận xóa hàng loạt"
        size="sm"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={onCloseBatchDelete} disabled={isBatchDeleting}>
              Hủy
            </Button>
            <Button variant="primary" onClick={onBatchDeleteConfirm} disabled={isBatchDeleting} className="!bg-[var(--danger)] !shadow-none hover:!bg-[var(--danger)]">
              {isBatchDeleting ? "Đang xóa..." : `Xóa ${selectedOrderIdsCount} đơn hàng`}
            </Button>
          </div>
        }
      >
        <div className="py-4 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-[var(--danger)]/10">
            <Trash2 className="size-8 text-[var(--danger)]" />
          </div>
          <p className="mb-2 text-[15px] font-bold text-[var(--fg-base)]">Bạn chắc chắn muốn xóa?</p>
          <p className="text-[13px] text-[var(--fg-muted)]">
            <span className="font-bold text-[var(--danger)]">{selectedOrderIdsCount}</span> đơn hàng sẽ bị đưa vào
            thùng rác. Bạn có thể khôi phục từ trang Thùng rác.
          </p>
        </div>
      </Modal>
    </>
  );
}
