"use client";

import dynamic from "next/dynamic";
import { Printer, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { appToast } from "@/shared/lib/toast";
import { formatDateShort } from "@/lib/utils";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { CreateFlowDialog } from "@/shared/ui/create-flow-shell";
import { queryKeys } from "@/shared/lib/react-query/query-keys";
import { vi } from "@/shared/messages/vi";
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
  const modalText = vi.orders.pageModals;
  const handlePrintNow = () => {
    const printContent = document.getElementById("invoice-print-area");
    if (!printContent) return;

    const windowObject = window.open("", "PrintWindow", "width=1000,height=800");
    if (!windowObject) return;

    windowObject.document.writeln(`<html><head><title>${modalText.printTitle}</title>`);
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
    <CreateFlowDialog
      isOpen={isOpen}
      onClose={onClose}
      title={modalText.printTitle}
      description="Preview hóa đơn trước khi in hoặc xuất cho khách."
      size="2xl"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            {modalText.close}
          </Button>
          <Button variant="primary" onClick={handlePrintNow} className="flex items-center gap-2">
            <Printer className="size-4" /> {modalText.printNow}
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
            {modalText.loadingData}
          </div>
        )}
      </div>
    </CreateFlowDialog>
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
  const modalText = vi.orders.pageModals;
  return (
    <CreateFlowDialog
      isOpen={isOpen}
      onClose={onClose}
      title={modalText.renewTitle(order?.order_code || order?.id?.slice(0, 8) || "")}
      description="Chỉnh lại ngày hết hạn ngay trong admin flow mà không cần rời khỏi chi tiết đơn hàng."
      size="md"
      footer={null}
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
              {modalText.renewOrderLabel} <strong className="font-mono text-[var(--fg-base)]">#{order.order_code || order.id.slice(0, 8)}</strong>
            </p>
            <p className="text-[13px] text-[var(--fg-muted)]">
              {modalText.renewCurrentDueDate}{" "}
              <strong className="text-[var(--accent)]">
                {order.expires_at ? formatDateShort(order.expires_at) : modalText.renewUnset}
              </strong>
            </p>
          </div>
          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
              {modalText.renewNewExpiry}
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
              {modalText.renewCancel}
            </Button>
            <Button type="submit" variant="primary" className="flex-1">
              {modalText.renewSubmit}
            </Button>
          </div>
        </form>
      )}
    </CreateFlowDialog>
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
    appToast.success(vi.orders.pageModals.paymentUpdated);
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

      <CreateFlowDialog
        isOpen={!!deletingOrder}
        onClose={onCloseDelete}
        title={vi.orders.pageModals.deleteOrderTitle}
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={onCloseDelete}>
              {vi.orders.pageModals.deleteOrderCancel}
            </Button>
            <Button variant="primary" onClick={onDeleteConfirm} className="!bg-[var(--danger)] !shadow-none hover:!bg-[var(--danger)]">
              {vi.orders.pageModals.deleteOrderConfirm}
            </Button>
          </div>
        }
      >
        <div className="py-4 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-[var(--danger)]/10">
            <Trash2 className="size-8 text-[var(--danger)]" />
          </div>
          <p className="mb-2 text-[15px] font-bold text-[var(--fg-base)]">{vi.orders.pageModals.deleteOrderQuestion}</p>
          <p className="text-[13px] text-[var(--fg-muted)]">
            {vi.orders.pageModals.deleteOrderWarning(deletingOrder?.order_code || deletingOrder?.id?.slice(0, 8) || "")}
          </p>
        </div>
      </CreateFlowDialog>

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

      <CreateFlowDialog
        isOpen={showBatchDeleteConfirm}
        onClose={onCloseBatchDelete}
        title={vi.orders.pageModals.batchDeleteTitle}
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={onCloseBatchDelete} disabled={isBatchDeleting}>
              {vi.orders.pageModals.batchDeleteCancel}
            </Button>
            <Button variant="primary" onClick={onBatchDeleteConfirm} disabled={isBatchDeleting} className="!bg-[var(--danger)] !shadow-none hover:!bg-[var(--danger)]">
              {isBatchDeleting ? vi.orders.pageModals.batchDeleteLoading : vi.orders.pageModals.batchDeleteQuestion(selectedOrderIdsCount)}
            </Button>
          </div>
        }
      >
        <div className="py-4 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-[var(--danger)]/10">
            <Trash2 className="size-8 text-[var(--danger)]" />
          </div>
          <p className="mb-2 text-[15px] font-bold text-[var(--fg-base)]">{vi.orders.pageModals.deleteOrderQuestion}</p>
          <p className="text-[13px] text-[var(--fg-muted)]">
            {vi.orders.pageModals.batchDeleteWarning(selectedOrderIdsCount)}
          </p>
        </div>
      </CreateFlowDialog>
    </>
  );
}
