"use client";

import { useState } from "react";
import { Trash2, AlertTriangle, Check, RefreshCw, Plus, Tag as TagIcon } from "lucide-react";
import { Modal } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/button";
import type { Customer } from "@/lib/domain/types";
import { TAG_PALETTE, randomPaletteColor } from "@/lib/constants/colors";
import { formatMoney } from "@/lib/utils";
import type { CustomerGroup, CustomerTag } from "@/shared/types/customers";

/* ─── Single Delete Modal ─── */
interface DeleteModalProps {
  customer: Customer | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteCustomerModal({ customer, onClose, onConfirm }: DeleteModalProps) {
  return (
    <Modal isOpen={!!customer} onClose={onClose} title="Xác nhận xóa" size="sm"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Hủy</Button>
          <Button variant="primary" onClick={onConfirm} className="!bg-[var(--danger)] hover:!bg-[var(--danger)] !shadow-none">Xóa</Button>
        </div>
      }
    >
      <div className="text-center py-4">
        <div className="size-16 bg-[var(--danger)]/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Trash2 className="size-8 text-[var(--danger)]" />
        </div>
        <p className="text-[15px] font-bold text-[var(--fg-base)] mb-2">Bạn chắc chắn muốn xóa?</p>
        <p className="text-[13px] text-[var(--fg-muted)]">
          Khách hàng <span className="font-bold text-[var(--fg-base)]">&ldquo;{customer?.name}&rdquo;</span> sẽ bị ẩn khỏi danh sách.
          Các đơn hàng liên quan vẫn được giữ nguyên.
        </p>
      </div>
    </Modal>
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
    <Modal isOpen={isOpen} onClose={onClose} title="Xóa hàng loạt" size="sm"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Hủy</Button>
          <Button variant="primary" onClick={onConfirm} disabled={isPending} className="!bg-[var(--danger)] hover:!bg-[var(--danger)] !shadow-none">
            {isPending ? "Đang xóa..." : `Xóa ${selectedCount} khách hàng`}
          </Button>
        </div>
      }
    >
      <div className="text-center py-4">
        <div className="size-16 bg-[var(--danger)]/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Trash2 className="size-8 text-[var(--danger)]" />
        </div>
        <p className="text-[15px] font-bold text-[var(--fg-base)] mb-2">Xóa {selectedCount} khách hàng?</p>
        {depInfo && depInfo.totalOrders > 0 && (
          <div className="bg-[var(--warning)]/10 border border-[var(--warning)]/30 rounded-xl p-3 text-left mb-3">
            <p className="text-[12px] font-bold text-[var(--warning)] flex items-center gap-1.5 mb-1">
              <AlertTriangle className="size-3.5" />
              Cảnh báo liên kết dữ liệu
            </p>
            <p className="text-[12px] text-[var(--fg-muted)]">
              <span className="font-bold">{depInfo.customersWithOrders}</span> khách có tổng cộng <span className="font-bold">{depInfo.totalOrders}</span> đơn hàng.
              Đơn hàng sẽ vẫn được giữ nguyên, khách hàng chỉ bị ẩn.
            </p>
          </div>
        )}
        <p className="text-[13px] text-[var(--fg-muted)]">
          Thao tác này sẽ ẩn các khách hàng khỏi danh sách (soft-delete).
        </p>
      </div>
    </Modal>
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
    <Modal isOpen={isOpen} onClose={onClose} title="Đổi phân loại hàng loạt" size="sm"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Hủy</Button>
          <Button variant="primary" onClick={() => onConfirm(value)} disabled={isPending}>
            {isPending ? "Đang cập nhật..." : `Áp dụng cho ${selectedCount} khách`}
          </Button>
        </div>
      }
    >
      <div className="py-4">
        <p className="text-[13px] text-[var(--fg-muted)] mb-4">Chọn phân loại mới cho <span className="font-bold text-[var(--fg-base)]">{selectedCount}</span> khách hàng đã chọn:</p>
        <div className="grid grid-cols-3 gap-3">
          {(["retail", "wholesale", "agency"] as const).map(t => (
            <button
              key={t}
              onClick={() => setValue(t)}
              className={`py-3 rounded-xl text-[13px] font-bold border transition-all ${
                value === t
                  ? "bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/30 shadow-sm"
                  : "bg-white text-[var(--fg-muted)] border-[var(--border-soft)] hover:bg-gray-50"
              }`}
            >
              {t === "retail" ? "Khách lẻ" : t === "wholesale" ? "Bán sỉ" : "Đại lý"}
            </button>
          ))}
        </div>
      </div>
    </Modal>
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
    <Modal isOpen={isOpen} onClose={handleClose} title="Gom nhóm khách hàng" size="sm"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={handleClose}>Hủy</Button>
          <Button variant="primary" onClick={() => onAssign(selectedGroupId)} disabled={!selectedGroupId || isAssigning}>
            {isAssigning ? "Đang gán..." : `Gán ${selectedCount} khách`}
          </Button>
        </div>
      }
    >
      <div className="py-4 space-y-4">
        <div>
          <label className="block text-[12px] font-bold text-[var(--fg-base)] mb-2">Chọn nhóm có sẵn</label>
          <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
            {groups.map(g => (
              <button
                key={g.id}
                onClick={() => setSelectedGroupId(g.id)}
                className={`px-3 py-2 border rounded-xl text-left transition-all text-[13px] ${
                  selectedGroupId === g.id ? "bg-[var(--accent)]/10 border-[var(--accent)]/50 ring-1 ring-[var(--accent)]" : "hover:bg-gray-50 border-[var(--border-soft)]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="size-3 rounded-full" style={{ backgroundColor: g.color }} />
                  <span className="font-bold flex-1 truncate">{g.name}</span>
                </div>
                <span className="text-[11px] text-[var(--fg-muted)]">{g.member_count ?? 0} thành viên</span>
              </button>
            ))}
            {groups.length === 0 && <p className="text-[12px] text-[var(--fg-muted)] col-span-2">Chưa có nhóm nào</p>}
          </div>
        </div>
        <div className="border-t border-[var(--border-soft)] my-2" />
        <div>
          <label className="block text-[12px] font-bold text-[var(--fg-base)] mb-2">Hoặc tạo nhóm mới</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Tên nhóm mới..."
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="flex-1 px-3 py-2 border border-[var(--border-soft)] rounded-xl text-[13px] outline-none focus:border-[var(--accent)]"
            />
            <Button variant="secondary" onClick={handleCreate} disabled={!newName.trim() || isCreating} className="!px-3 bg-gray-50">
              <Plus className="size-4" />
            </Button>
          </div>
          <div className="mt-2">
            <p className="text-[11px] font-bold text-[var(--fg-muted)] mb-1.5">Màu sắc</p>
            <div className="flex gap-1.5 flex-wrap">
              {TAG_PALETTE.slice(0, 8).map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewColor(c)}
                  className={`size-5 rounded-full transition-all ${newColor === c ? "ring-2 ring-offset-1 ring-[var(--accent)] scale-110" : "hover:scale-110"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <textarea
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            placeholder="Mô tả nhóm (tùy chọn)..."
            rows={2}
            className="w-full mt-2 px-3 py-2 border border-[var(--border-soft)] rounded-xl text-[12px] outline-none focus:border-[var(--accent)] resize-none"
          />
        </div>
      </div>
    </Modal>
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
    <Modal isOpen={isOpen} onClose={handleClose} title="Gắn tag hàng loạt" size="sm"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={handleClose}>Hủy</Button>
          <Button variant="primary" onClick={() => { onAssign(selectedTagId); setSelectedTagId(""); }} disabled={!selectedTagId || isPending}>
            {isPending ? "Đang gắn..." : `Gắn tag cho ${selectedCount} khách`}
          </Button>
        </div>
      }
    >
      <div className="py-4">
        <p className="text-[13px] text-[var(--fg-muted)] mb-4">Chọn tag để gắn cho <span className="font-bold text-[var(--fg-base)]">{selectedCount}</span> khách hàng đã chọn:</p>
        {tags.length === 0 ? (
          <div className="text-center py-6">
            <TagIcon className="size-8 text-[var(--fg-muted)] opacity-30 mx-auto mb-2" />
            <p className="text-[12px] text-[var(--fg-muted)] mb-3">Chưa có tag nào</p>
            {onOpenGroupTag && (
              <Button variant="secondary" onClick={() => { handleClose(); onOpenGroupTag(); }} className="text-[12px]">
                Tạo tag mới
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
              <button
                key={tag.id}
                onClick={() => setSelectedTagId(tag.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-bold border transition-all ${
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
                <span className="size-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
                {tag.name}
                {selectedTagId === tag.id && <Check className="size-3.5 ml-1" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
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

  // Reset state when customer changes
  if (customer && debtDays === "" && debtAmount === "") {
    setDebtDays(customer.debtOverdueDays.toString());
    setDebtAmount(customer.debtAmountVnd.toString());
  }

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
    <Modal isOpen={!!customer} onClose={handleClose} title="Gia hạn / Cập nhật Công nợ" size="sm"
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" onClick={handleClose} className="flex-1">Hủy</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving} className="flex-1 !bg-gradient-to-r !from-[var(--warning)] !to-orange-500">
            {saving && <RefreshCw className="size-4 animate-spin mr-1" />}
            Lưu thay đổi
          </Button>
        </div>
      }
    >
      <div className="py-2">
        <p className="text-[12px] text-[var(--fg-muted)] mb-4">{customer?.name}</p>
        <label className="block text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-widest mb-2">Số ngày quá hạn mới</label>
        <input
          type="number"
          min={0}
          value={debtDays}
          onChange={e => setDebtDays(e.target.value)}
          placeholder={`Hiện tại: ${customer?.debtOverdueDays ?? 0} ngày`}
          className="w-full px-3 py-2.5 bg-white border border-[var(--border-soft)] rounded-xl text-[13px] font-medium outline-none focus:border-[var(--accent)] transition-colors mb-3"
        />
        <label className="block text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-widest mb-2">Số tiền công nợ (VNĐ)</label>
        <input
          type="number"
          min={0}
          value={debtAmount}
          onChange={e => setDebtAmount(e.target.value)}
          placeholder={`Hiện tại: ${formatMoney(customer?.debtAmountVnd ?? 0)}`}
          className="w-full px-3 py-2.5 bg-white border border-[var(--border-soft)] rounded-xl text-[13px] font-medium outline-none focus:border-[var(--accent)] transition-colors"
        />
      </div>
    </Modal>
  );
}
