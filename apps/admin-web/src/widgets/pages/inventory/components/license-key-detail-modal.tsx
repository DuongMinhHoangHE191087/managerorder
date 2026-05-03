"use client";

import { useMemo } from "react";
import { AlertTriangle, KeyRound, Trash2 } from "lucide-react";

import { CreateActionFooter, CreateFlowDialog } from "@/shared/ui/create-flow-shell";
import { Button } from "@/shared/ui/button";
import { cn, formatDateLabel } from "@/lib/utils";
import { useInventoryKeyDetail } from "@/widgets/pages/inventory/hooks/use-inventory";
import { SoftDeletedBadge } from "@/shared/ui/soft-deleted-badge";
import { INVENTORY_COPY as copy } from "../copy";

interface LicenseKeyDetailModalProps {
  isOpen: boolean;
  licenseKeyId: string | null;
  includeDeleted?: boolean;
  productMap: Map<string, string>;
  onClose: () => void;
  onRestore: () => Promise<void>;
  onPurge: () => Promise<void>;
}

function getStatusTone(status: string) {
  switch (status) {
    case "available":
      return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
    case "reserved":
      return "bg-amber-500/10 text-amber-700 border-amber-500/20";
    case "used":
      return "bg-blue-500/10 text-blue-700 border-blue-500/20";
    case "expired":
    case "invalid":
      return "bg-red-500/10 text-red-700 border-red-500/20";
    default:
      return "bg-slate-500/10 text-slate-600 border-slate-500/20";
  }
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-light)] px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">{label}</p>
      <p className="mt-1 break-words text-[13px] font-semibold text-[var(--fg-base)]">{value}</p>
    </div>
  );
}

export function LicenseKeyDetailModal({
  isOpen,
  licenseKeyId,
  includeDeleted = false,
  productMap,
  onClose,
  onRestore,
  onPurge,
}: LicenseKeyDetailModalProps) {
  const { data: detailResult, isLoading, isError } = useInventoryKeyDetail(licenseKeyId, includeDeleted);
  const key = detailResult?.data ?? null;
  const isTrashView = includeDeleted || Boolean(detailResult?.softDeleted);

  const productName = useMemo(() => {
    if (!key) return "—";
    return productMap.get(key.productId) ?? key.productId;
  }, [key, productMap]);

  const deletedAt = key?.deleted_at ?? null;

  return (
    <CreateFlowDialog
      isOpen={isOpen}
      onClose={onClose}
      title={
        isTrashView ? (
          <>
            {copy.licenseKeyDetail.title}
            <SoftDeletedBadge className="ml-3" />
          </>
        ) : (
          copy.licenseKeyDetail.title
        )
      }
      description={copy.licenseKeyDetail.description}
      size="md"
      footer={
        isTrashView && key ? (
          <div className="grid w-full gap-3 sm:grid-cols-3">
            <Button variant="secondary" onClick={onClose}>
              {copy.licenseKeyDetail.close}
            </Button>
            <Button variant="primary" onClick={() => void onRestore()}>
              {copy.licenseKeyDetail.restore}
            </Button>
            <Button variant="danger" onClick={() => void onPurge()}>
              {copy.licenseKeyDetail.purge}
            </Button>
          </div>
        ) : (
          <CreateActionFooter primaryLabel={copy.licenseKeyDetail.close} onPrimary={onClose} />
        )
      }
    >
      {isLoading ? (
        <div className="space-y-4 py-4">
          <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
          </div>
        </div>
      ) : isError || !key ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-red-500/10">
            <AlertTriangle className="size-7 text-red-500" />
          </div>
          <div>
            <p className="text-[15px] font-bold text-[var(--fg-base)]">{copy.licenseKeyDetail.notFoundTitle}</p>
            <p className="mt-1 text-[13px] text-[var(--fg-muted)]">{copy.licenseKeyDetail.notFoundDescription}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {isTrashView ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-[13px] font-medium text-amber-700">
              {copy.licenseKeyDetail.trashBanner}
            </div>
          ) : null}

          <div className="flex items-center gap-4 rounded-2xl border border-[var(--border-soft)] bg-gradient-to-r from-[var(--accent)]/5 to-transparent p-4">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)]">
              <KeyRound className="size-7" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-[18px] font-black tracking-tight text-[var(--fg-base)]">{key.keyCode}</h3>
              <p className="mt-1 text-[13px] font-medium text-[var(--fg-muted)]">
                {copy.licenseKeyDetail.productPrefix} {productName}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <DetailRow label={copy.licenseKeyDetail.rowLabels.keyCode} value={key.keyCode} />
            <DetailRow label={copy.licenseKeyDetail.rowLabels.status} value={key.status} />
            <DetailRow label={copy.licenseKeyDetail.rowLabels.product} value={productName} />
            <DetailRow label={copy.licenseKeyDetail.rowLabels.id} value={key.id} />
            <DetailRow label={copy.licenseKeyDetail.rowLabels.createdAt} value={formatDateLabel(key.created_at ?? null)} />
            <DetailRow label={copy.licenseKeyDetail.rowLabels.updatedAt} value={formatDateLabel(key.updated_at ?? null)} />
            <DetailRow label={copy.licenseKeyDetail.rowLabels.orderId} value={key.order_id ? String(key.order_id) : "—"} />
            <DetailRow label={copy.licenseKeyDetail.rowLabels.assignedAt} value={formatDateLabel(key.assigned_at ?? null)} />
            {isTrashView ? <DetailRow label={copy.licenseKeyDetail.rowLabels.deletedAt} value={formatDateLabel(deletedAt)} /> : null}
          </div>

          <div className="flex items-center gap-2">
            <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider", getStatusTone(key.status))}>
              <span className="size-2 rounded-full bg-current" />
              {key.status}
            </span>
            {isTrashView ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-700">
                <Trash2 className="size-3.5" />
                {copy.licenseKeyDetail.statusBadge.trash}
              </span>
            ) : null}
          </div>

          {isTrashView ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-[13px] text-slate-700">
              {copy.licenseKeyDetail.trashNote}
            </div>
          ) : null}
        </div>
      )}
    </CreateFlowDialog>
  );
}
