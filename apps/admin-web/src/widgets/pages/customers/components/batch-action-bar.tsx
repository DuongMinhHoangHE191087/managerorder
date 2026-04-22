"use client";

import { FolderPlus, Tag, Trash2, XCircle } from "lucide-react";
import { vi } from "@/shared/messages/vi";

interface BatchActionBarProps {
  selectedCount: number;
  onGroupAssign: () => void;
  onBatchTag: () => void;
  onBatchTier: () => void;
  onBatchDelete: () => void;
  onClearSelection: () => void;
}

export function BatchActionBar({
  selectedCount,
  onGroupAssign,
  onBatchTag,
  onBatchTier,
  onBatchDelete,
  onClearSelection,
}: BatchActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="sticky top-0 z-30 bg-[var(--accent)]/10 border border-[var(--accent)]/30 rounded-2xl p-3 flex items-center justify-between gap-3 backdrop-blur-sm animate-in slide-in-from-bottom-2">
      <div className="flex items-center gap-3">
        <span className="bg-[var(--accent)] text-white text-xs font-bold px-2.5 py-1 rounded-full">
          {selectedCount}
        </span>
        <span className="text-[13px] font-bold text-[var(--fg-base)]">
          {vi.customers.batch.selectedCustomers}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onGroupAssign}
          className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-bold bg-[#6366f1]/10 text-[#6366f1] border border-[#6366f1]/30 rounded-xl hover:bg-[#6366f1]/20 transition-colors"
        >
          <FolderPlus className="size-3.5" />
          {vi.customers.batch.groupAssign}
        </button>
        <button
          onClick={onBatchTag}
          className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-bold bg-[#ec4899]/10 text-[#ec4899] border border-[#ec4899]/30 rounded-xl hover:bg-[#ec4899]/20 transition-colors"
        >
          <Tag className="size-3.5" />
          {vi.customers.batch.tagAssign}
        </button>
        <button
          onClick={onBatchTier}
          className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-bold bg-white border border-[var(--border-soft)] rounded-xl hover:bg-gray-50 transition-colors text-[var(--fg-base)]"
        >
          {vi.customers.batch.batchTier}
        </button>
        <button
          onClick={onBatchDelete}
          className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-bold bg-[var(--danger)]/10 text-[var(--danger)] border border-[var(--danger)]/30 rounded-xl hover:bg-[var(--danger)]/20 transition-colors"
        >
          <Trash2 className="size-3.5" />
          {vi.customers.batch.batchDelete}
        </button>
        <button
          onClick={onClearSelection}
          className="p-2 text-[var(--fg-muted)] hover:text-[var(--fg-base)] transition-colors"
          title={vi.customers.batch.clearSelection}
        >
          <XCircle className="size-4" />
        </button>
      </div>
    </div>
  );
}
