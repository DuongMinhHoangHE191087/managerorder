"use client";

import { useEffect, useState } from "react";
import { Trash2, AlertTriangle, Check, RefreshCw, Plus, Tag as TagIcon } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { CreateFlowDialog } from "@/shared/ui/create-flow-shell";
import type { Customer } from "@/lib/domain/types";
import { TAG_PALETTE, randomPaletteColor } from "@/lib/constants/colors";
import { formatMoney } from "@/lib/utils";
import { vi } from "@/shared/messages/vi";
import type { CustomerGroup, CustomerTag } from "@/shared/types/customers";

const modalText = vi.customers.modalsUi;

/* ─── Single Delete Modal ─── */
interface DeleteModalProps {
  customer: Customer | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteCustomerModal({ customer, onClose, onConfirm }: DeleteModalProps) {
  return (
    <CreateFlowDialog isOpen={!!customer} onClose={onClose} title={modalText.delete.title} size="md"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>{modalText.delete.cancel}</Button>
          <Button variant="primary" onClick={onConfirm} className="!bg-[var(--danger)] hover:!bg-[var(--danger)] !shadow-none">{modalText.delete.confirm}</Button>
        </div>
      }
    >
      <div className="text-center py-4">
        <div className="size-16 bg-[var(--danger)]/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Trash2 className="size-8 text-[var(--danger)]" />
        </div>
        <p className="text-[15px] font-bold text-[var(--fg-base)] mb-2">{modalText.delete.question}</p>
        <p className="text-[13px] text-[var(--fg-muted)]">
          {modalText.delete.body(customer?.name ?? "")}
        </p>
      </div>
    </CreateFlowDialog>
  );
}

/* ─── Batch Delete Modal ─── */
interface BatchDeleteModalProps {
  isOpen: boolean;
  selectedCount: number;
  depInfo: { customersWithOrders: number; totalOrders: number } | null;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function BatchDeleteModal({ isOpen, selectedCount, depInfo, isPending, onClose, onConfirm }: BatchDeleteModalProps) {
  return (
    <CreateFlowDialog isOpen={isOpen} onClose={onClose} title={modalText.batchDelete.title} size="md"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>{modalText.batchDelete.cancel}</Button>
          <Button variant="primary" onClick={onConfirm} disabled={isPending} className="!bg-[var(--danger)] hover:!bg-[var(--danger)] !shadow-none">
            {isPending ? modalText.batchDelete.pending : modalText.batchDelete.confirm(selectedCount)}
          </Button>
        </div>
      }
    >
      <div className="text-center py-4">
        <div className="size-16 bg-[var(--danger)]/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Trash2 className="size-8 text-[var(--danger)]" />
        </div>
        <p className="text-[15px] font-bold text-[var(--fg-base)] mb-2">{modalText.batchDelete.question(selectedCount)}</p>
        {depInfo && depInfo.totalOrders > 0 && (
          <div className="bg-[var(--warning)]/10 border border-[var(--warning)]/30 rounded-xl p-3 text-left mb-3">
            <p className="text-[12px] font-bold text-[var(--warning)] flex items-center gap-1.5 mb-1">
              <AlertTriangle className="size-3.5" />
              {modalText.batchDelete.warningTitle}
            </p>
            <p className="text-[12px] text-[var(--fg-muted)]">
              {modalText.batchDelete.warningBody(depInfo.customersWithOrders, depInfo.totalOrders)}
            </p>
          </div>
        )}
        <p className="text-[13px] text-[var(--fg-muted)]">
          {modalText.batchDelete.note}
        </p>
      </div>
    </CreateFlowDialog>
  );
}

/* ─── Batch Tier Modal ─── */
interface BatchTierModalProps {
  isOpen: boolean;
  selectedCount: number;
  isPending: boolean;
  onClose: () => void;
  onConfirm: (tier: "retail" | "wholesale" | "agency") => void;
}

export function BatchTierModal({ isOpen, selectedCount, isPending, onClose, onConfirm }: BatchTierModalProps) {
  const [value, setValue] = useState<"retail" | "wholesale" | "agency">("retail");
  return (
    <CreateFlowDialog isOpen={isOpen} onClose={onClose} title={modalText.batchTier.title} size="md"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>{modalText.batchTier.cancel}</Button>
          <Button variant="primary" onClick={() => onConfirm(value)} disabled={isPending}>
            {isPending ? modalText.batchTier.pending : modalText.batchTier.confirm(selectedCount)}
          </Button>
        </div>
      }
    >
      <div className="py-4">
        <p className="text-[13px] text-[var(--fg-muted)] mb-4">{modalText.batchTier.description(selectedCount)}</p>
        <div className="grid grid-cols-3 gap-3">
          {(["retail", "wholesale", "agency"] as const).map(t => (
            <button
              key={t}
              type="button"
              aria-pressed={value === t}
              onClick={() => setValue(t)}
              className={`py-3 rounded-xl text-[13px] font-bold border transition-[background-color,border-color,color,box-shadow] ${
                value === t
              ? "bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/30 shadow-sm"
              : "bg-white text-[var(--fg-muted)] border-[var(--border-soft)] hover:bg-gray-50"
              }`}
            >
              {t === "retail" ? modalText.batchTier.retail : t === "wholesale" ? modalText.batchTier.wholesale : modalText.batchTier.agency}
            </button>
          ))}
        </div>
      </div>
    </CreateFlowDialog>
  );
}

/* ─── Group Assign Modal ─── */
interface GroupAssignModalProps {
  isOpen: boolean;
  selectedCount: number;
  groups: CustomerGroup[];
  isAssigning: boolean;
  isCreating: boolean;
  onClose: () => void;
  onAssign: (groupId: string) => void;
  onCreate: (input: { name: string; color: string; description?: string }) => Promise<{ data: { id: string } }>;
}

export function GroupAssignModal({ isOpen, selectedCount, groups, isAssigning, isCreating, onClose, onAssign, onCreate }: GroupAssignModalProps) {
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(TAG_PALETTE[0]);
  const [newDesc, setNewDesc] = useState("");

  async function handleCreate() {
    if (!newName.trim()) return;
    try {
      const result = await onCreate({ name: newName.trim(), color: newColor, description: newDesc.trim() || undefined });
      setSelectedGroupId(result.data.id);
      setNewName("");
      setNewDesc("");
      setNewColor(randomPaletteColor());
    } catch {
      // handled by hook
    }
  }

  function handleClose() {
    setSelectedGroupId("");
    setNewName("");
    setNewDesc("");
    onClose();
  }

  return (
    <CreateFlowDialog isOpen={isOpen} onClose={handleClose} title={modalText.groupAssign.title} size="lg"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={handleClose}>{modalText.groupAssign.cancel}</Button>
          <Button variant="primary" onClick={() => onAssign(selectedGroupId)} disabled={!selectedGroupId || isAssigning}>
            {isAssigning ? modalText.groupAssign.pending : modalText.groupAssign.confirm(selectedCount)}
          </Button>
        </div>
      }
    >
      <div className="py-4 space-y-4">
        <div>
          <label className="block text-[12px] font-bold text-[var(--fg-base)] mb-2">{modalText.groupAssign.availableLabel}</label>
          <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
            {groups.map(g => (
              <button
                key={g.id}
                type="button"
                aria-pressed={selectedGroupId === g.id}
                onClick={() => setSelectedGroupId(g.id)}
                className={`px-3 py-2 border rounded-xl text-left transition-[background-color,border-color,box-shadow] text-[13px] ${
                  selectedGroupId === g.id ? "bg-[var(--accent)]/10 border-[var(--accent)]/50 ring-1 ring-[var(--accent)]" : "hover:bg-gray-50 border-[var(--border-soft)]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="size-3 rounded-full" style={{ backgroundColor: g.color }} />
                  <span className="font-bold flex-1 truncate">{g.name}</span>
                </div>
                <span className="text-[11px] text-[var(--fg-muted)]">{g.member_count ?? 0} {modalText.groupAssign.memberSuffix}</span>
              </button>
            ))}
            {groups.length === 0 && <p className="text-[12px] text-[var(--fg-muted)] col-span-2">{modalText.groupAssign.empty}</p>}
          </div>
        </div>
        <div className="border-t border-[var(--border-soft)] my-2" />
        <div>
          <label className="block text-[12px] font-bold text-[var(--fg-base)] mb-2">{modalText.groupAssign.createNewLabel}</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder={modalText.groupAssign.namePlaceholder}
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="flex-1 px-3 py-2 border border-[var(--border-soft)] rounded-xl text-[13px] outline-none focus:border-[var(--accent)]"
            />
            <Button variant="secondary" onClick={handleCreate} disabled={!newName.trim() || isCreating} className="!px-3 bg-gray-50">
              <Plus className="size-4" />
            </Button>
          </div>
          <div className="mt-2">
            <p className="text-[11px] font-bold text-[var(--fg-muted)] mb-1.5">{modalText.groupAssign.colorLabel}</p>
            <div className="flex gap-1.5 flex-wrap">
              {TAG_PALETTE.slice(0, 8).map(c => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Chọn màu ${c}`}
                  aria-pressed={newColor === c}
                  onClick={() => setNewColor(c)}
                  className={`size-5 rounded-full transition-[box-shadow,transform] ${newColor === c ? "ring-2 ring-offset-1 ring-[var(--accent)] scale-110" : "hover:scale-110"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <textarea
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            placeholder={modalText.groupAssign.descriptionPlaceholder}
            rows={2}
            className="w-full mt-2 px-3 py-2 border border-[var(--border-soft)] rounded-xl text-[12px] outline-none focus:border-[var(--accent)] resize-none"
          />
        </div>
      </div>
    </CreateFlowDialog>
  );
}

/* ─── Batch Tag Modal ─── */
interface BatchTagModalProps {
  isOpen: boolean;
  selectedCount: number;
  tags: CustomerTag[];
  isPending: boolean;
  onClose: () => void;
  onAssign: (tagId: string) => void;
  onOpenGroupTag?: () => void;
}

export function BatchTagModal({ isOpen, selectedCount, tags, isPending, onClose, onAssign, onOpenGroupTag }: BatchTagModalProps) {
  const [selectedTagId, setSelectedTagId] = useState("");

  function handleClose() {
    setSelectedTagId("");
    onClose();
  }

  return (
    <CreateFlowDialog isOpen={isOpen} onClose={handleClose} title={modalText.batchTag.title} size="md"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={handleClose}>{modalText.batchTag.cancel}</Button>
          <Button variant="primary" onClick={() => { onAssign(selectedTagId); setSelectedTagId(""); }} disabled={!selectedTagId || isPending}>
            {isPending ? modalText.batchTag.pending : modalText.batchTag.confirm(selectedCount)}
          </Button>
        </div>
      }
    >
      <div className="py-4">
        <p className="text-[13px] text-[var(--fg-muted)] mb-4">{modalText.batchTag.description(selectedCount)}</p>
        {tags.length === 0 ? (
          <div className="text-center py-6">
            <TagIcon className="size-8 text-[var(--fg-muted)] opacity-30 mx-auto mb-2" />
            <p className="text-[12px] text-[var(--fg-muted)] mb-3">{modalText.batchTag.empty}</p>
            {onOpenGroupTag && (
              <Button variant="secondary" onClick={() => { handleClose(); onOpenGroupTag(); }} className="text-[12px]">
                {modalText.batchTag.createNew}
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
              <button
                key={tag.id}
                type="button"
                aria-pressed={selectedTagId === tag.id}
                onClick={() => setSelectedTagId(tag.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-bold border transition-[border-color,box-shadow,opacity] ${
                  selectedTagId === tag.id
                    ? "ring-2 ring-[var(--accent)] shadow-sm"
                    : "hover:opacity-80"
                }`}
                style={{
                  backgroundColor: `${tag.color}12`,
                  color: tag.color,
                  borderColor: selectedTagId === tag.id ? tag.color : `${tag.color}30`,
                }}
              >
                <span aria-hidden="true" className="size-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
                {tag.name}
                {selectedTagId === tag.id && <Check aria-hidden="true" className="size-3.5 ml-1" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </CreateFlowDialog>
  );
}

/* ─── Renewal Modal (M3 fix: now uses <Modal>) ─── */
interface RenewalModalProps {
  customer: Customer | null;
  onClose: () => void;
  onSave: (debtDays: string, debtAmount: string) => Promise<void>;
}

export function RenewalModal({ customer, onClose, onSave }: RenewalModalProps) {
  const [debtDays, setDebtDays] = useState("");
  const [debtAmount, setDebtAmount] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!customer) {
      setDebtDays("");
      setDebtAmount("");
      return;
    }

    setDebtDays(customer.debtOverdueDays.toString());
    setDebtAmount(customer.debtAmountVnd.toString());
  }, [customer]);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(debtDays, debtAmount);
      setDebtDays("");
      setDebtAmount("");
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    setDebtDays("");
    setDebtAmount("");
    onClose();
  }

  return (
    <CreateFlowDialog isOpen={!!customer} onClose={handleClose} title={modalText.renewal.title} size="md"
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" onClick={handleClose} className="flex-1">{modalText.renewal.cancel}</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving} className="flex-1 !bg-gradient-to-r !from-[var(--warning)] !to-orange-500">
            {saving && <RefreshCw className="size-4 animate-spin mr-1" />}
            {modalText.renewal.save}
          </Button>
        </div>
      }
    >
      <div className="py-2">
        <p className="text-[12px] text-[var(--fg-muted)] mb-4">{customer?.name}</p>
        <label className="block text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-widest mb-2">{modalText.renewal.currentDebtDays}</label>
        <input
          type="number"
          min={0}
          value={debtDays}
          onChange={e => setDebtDays(e.target.value)}
          placeholder={modalText.renewal.currentDebtDaysPlaceholder(customer?.debtOverdueDays ?? 0)}
          className="w-full px-3 py-2.5 bg-white border border-[var(--border-soft)] rounded-xl text-[13px] font-medium outline-none focus:border-[var(--accent)] transition-colors mb-3"
        />
        <label className="block text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-widest mb-2">{modalText.renewal.currentDebtAmount}</label>
        <input
          type="number"
          min={0}
          value={debtAmount}
          onChange={e => setDebtAmount(e.target.value)}
          placeholder={modalText.renewal.currentDebtAmountPlaceholder(formatMoney(customer?.debtAmountVnd ?? 0))}
          className="w-full px-3 py-2.5 bg-white border border-[var(--border-soft)] rounded-xl text-[13px] font-medium outline-none focus:border-[var(--accent)] transition-colors"
        />
      </div>
    </CreateFlowDialog>
  );
}
