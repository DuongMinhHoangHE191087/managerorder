"use client";

import { useState } from "react";
import { Check, Pencil, Plus, Trash2, WalletCards, X } from "lucide-react";
import { appToast } from "@/shared/ui/app-toast";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { CreateFormSection } from "@/shared/ui/create-flow-shell";
import {
  useCreatePaymentSource,
  useDeletePaymentSource,
  usePaymentSources,
  useUpdatePaymentSource,
} from "@/widgets/pages/settings/hooks/use-settings";
import { QrCode, Copy, CheckCheck } from "lucide-react";
import { useOrders } from "@/widgets/pages/orders/hooks/use-orders";
import { vi } from "@/shared/messages/vi";

export function PaymentSourceManager() {
  const { data: sources = [], isLoading } = usePaymentSources();
  const { mutateAsync: createSource, isPending: creatingSource } = useCreatePaymentSource();
  const { mutateAsync: updateSource, isPending: updatingSource } = useUpdatePaymentSource();
  const { mutateAsync: deleteSource, isPending: deletingSource } = useDeletePaymentSource();

  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("💳");
  const [newBankName, setNewBankName] = useState("");
  const [newAccountNumber, setNewAccountNumber] = useState("");

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [editBankName, setEditBankName] = useState("");
  const [editAccountNumber, setEditAccountNumber] = useState("");

  async function handleAdd() {
    const trimmedName = newName.trim();
    if (!trimmedName) {
      appToast.error("Vui lòng nhập tên nguồn thanh toán");
      return;
    }

    try {
      const newSource = await createSource({
        name: trimmedName,
        icon: newIcon || "💳",
        bank_name: newBankName.trim() || null,
        account_number: newAccountNumber.trim() || null,
      });
      setNewName("");
      setNewIcon("💳");
      setNewBankName("");
      setNewAccountNumber("");
      appToast.success(`Đã thêm: ${newSource.name}`);
    } catch {
      appToast.error("Không thể tạo nguồn thanh toán");
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteSource(id);
      appToast.success("Đã xoá nguồn thanh toán");
    } catch {
      appToast.error("Không thể xoá nguồn thanh toán");
    }
  }

  async function handleSaveEdit(id: string) {
    const trimmedName = editName.trim();
    if (!trimmedName) {
      appToast.error("Vui lòng nhập tên nguồn thanh toán");
      return;
    }

    try {
      await updateSource({
        id,
        name: trimmedName,
        icon: editIcon || "💳",
        bank_name: editBankName.trim() || null,
        account_number: editAccountNumber.trim() || null,
      });
      setEditId(null);
      appToast.success("Đã cập nhật nguồn thanh toán");
    } catch {
      appToast.error("Không thể cập nhật nguồn thanh toán");
    }
  }

  if (isLoading) {
    return <div className="animate-pulse py-4 text-center text-[13px] text-[var(--fg-muted)]">Đang tải...</div>;
  }

  return (
    <div className="space-y-4">
      <CreateFormSection
        title="Tạo nguồn thanh toán"
        description=""
      >
        <div className="grid gap-3 md:grid-cols-[72px_1.2fr_1fr_1fr_auto]">
          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
              Icon
            </label>
            <Input
              className="h-12 text-center text-[20px]"
              value={newIcon}
              onChange={(event) => setNewIcon(event.target.value)}
              placeholder="💳"
              maxLength={2}
            />
          </div>
          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
              Tên nguồn
            </label>
            <Input
              className="h-12"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void handleAdd();
                }
              }}
              placeholder="MoMo, MB Bank, Tiền mặt..."
            />
          </div>
          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
              Tên ngân hàng
            </label>
            <Input
              className="h-12"
              value={newBankName}
              onChange={(event) => setNewBankName(event.target.value)}
              placeholder="MB, VCB, MoMo..."
            />
          </div>
          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
              Số tài khoản
            </label>
            <Input
              className="h-12"
              value={newAccountNumber}
              onChange={(event) => setNewAccountNumber(event.target.value)}
              placeholder="0394497949..."
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={() => {
                void handleAdd();
              }}
              disabled={!newName.trim() || creatingSource}
              isLoading={creatingSource}
              className="h-12 w-full md:w-auto"
            >
              <Plus className="size-4" />
              Thêm
            </Button>
          </div>
        </div>
      </CreateFormSection>

      <div className="space-y-3">
        {sources.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border-soft)] bg-white/70 px-4 py-5 text-center text-[13px] italic text-[var(--fg-muted)]">
            Chưa có nguồn thanh toán nào.
          </div>
        ) : null}

        {sources.map((source) => (
          <div
            key={source.id}
            className="group rounded-2xl border border-[var(--border-soft)] bg-white p-4 transition-colors hover:border-[var(--accent)]/30"
          >
            {editId === source.id ? (
              <div className="grid gap-3 md:grid-cols-[64px_1.2fr_1fr_1fr_auto]">
                <Input
                  className="h-11 px-1 text-center text-[18px]"
                  value={editIcon}
                  onChange={(event) => setEditIcon(event.target.value)}
                  maxLength={2}
                />
                <Input
                  className="h-11 bg-[var(--bg-app)]"
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void handleSaveEdit(source.id);
                    }
                  }}
                  placeholder="Tên nguồn"
                />
                <Input
                  className="h-11 bg-[var(--bg-app)]"
                  value={editBankName}
                  onChange={(event) => setEditBankName(event.target.value)}
                  placeholder="Tên ngân hàng"
                />
                <Input
                  className="h-11 bg-[var(--bg-app)]"
                  value={editAccountNumber}
                  onChange={(event) => setEditAccountNumber(event.target.value)}
                  placeholder="Số tài khoản"
                />
                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      void handleSaveEdit(source.id);
                    }}
                    disabled={updatingSource}
                  >
                    <Check className="size-4" />
                    Lưu
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditId(null)}>
                    <X className="size-4" />
                    Hủy
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--surface-light)] text-[20px]">
                    {source.icon || <WalletCards className="size-5 text-[var(--fg-muted)]" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-black text-[var(--fg-base)]">{source.name}</span>
                      {(source.bank_name || source.account_number) && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                          {source.bank_name ? source.bank_name : ""}{source.bank_name && source.account_number ? " • " : ""}{source.account_number ? source.account_number : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setEditId(source.id);
                      setEditName(source.name);
                      setEditIcon(source.icon || "💳");
                      setEditBankName(source.bank_name || "");
                      setEditAccountNumber(source.account_number || "");
                    }}
                  >
                    <Pencil className="size-4" />
                    Sửa
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      void handleDelete(source.id);
                    }}
                    disabled={deletingSource}
                  >
                    <Trash2 className="size-4" />
                    Xóa
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 pt-6 border-t border-[var(--border-soft)]">
        <VietQRGenerator sources={sources} />
      </div>
    </div>
  );
}

function VietQRGenerator({ sources }: { sources: any[] }) {
  const bankSources = sources.filter((s) => s.bank_name && s.account_number);
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [memo, setMemo] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  const { data: pendingOrdersRes, isLoading: loadingOrders } = useOrders({
    status: "pending_payment",
    limit: 50,
  });
  const pendingOrders = (pendingOrdersRes?.data || []) as any[];

  function handleOrderChange(orderId: string) {
    setSelectedOrderId(orderId);
    if (!orderId) {
      setAmount("");
      setMemo("");
      return;
    }
    const order = pendingOrders.find((o) => o.id === orderId);
    if (order) {
      setAmount(order.total_amount_vnd || 0);
      setMemo(order.order_code || order.id.slice(0, 8).toUpperCase());
    }
  }

  const selectedSource = bankSources.find((s) => s.id === selectedSourceId);
  const qrUrl = selectedSource
    ? `https://img.vietqr.io/image/${selectedSource.bank_name.replace(/\s+/g, "")}-${selectedSource.account_number}-compact2.png?amount=${amount || 0}&addInfo=${encodeURIComponent(memo)}`
    : "";

  const transferText = selectedSource
    ? `Ngân hàng: ${selectedSource.bank_name}\nSố tài khoản: ${selectedSource.account_number}\nSố tiền: ${amount ? amount.toLocaleString("vi-VN") + " đ" : "Tùy chọn"}\nNội dung: ${memo || "Không có"}`
    : "";

  function handleCopyLink() {
    if (!qrUrl) return;
    navigator.clipboard.writeText(qrUrl).then(() => {
      setCopiedLink(true);
      appToast.success(vi.common.copySuccess);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  }

  function handleCopyText() {
    if (!transferText) return;
    navigator.clipboard.writeText(transferText).then(() => {
      setCopiedText(true);
      appToast.success(vi.common.copySuccess);
      setTimeout(() => setCopiedText(false), 2000);
    });
  }

  return (
    <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <QrCode className="size-5 text-[var(--accent)]" />
        <h3 className="text-[15px] font-bold text-[var(--fg-base)]">Trình sinh VietQR tự động</h3>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
              Chọn nguồn thanh toán
            </label>
            <select
              value={selectedSourceId}
              onChange={(e) => setSelectedSourceId(e.target.value)}
              className="h-11 w-full rounded-xl border border-[var(--border-soft)] bg-white px-3 text-[13px] font-medium text-[var(--fg-base)] outline-none focus:border-[var(--accent)] transition-colors cursor-pointer"
            >
              <option value="">-- Chọn tài khoản ngân hàng --</option>
              {bankSources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.icon} {source.name} ({source.bank_name} - {source.account_number})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
              Chọn đơn hàng chưa thanh toán
            </label>
            <select
              value={selectedOrderId}
              onChange={(e) => handleOrderChange(e.target.value)}
              disabled={loadingOrders}
              className="h-11 w-full rounded-xl border border-[var(--border-soft)] bg-white px-3 text-[13px] font-medium text-[var(--fg-base)] outline-none focus:border-[var(--accent)] transition-colors cursor-pointer disabled:opacity-50"
            >
              <option value="">-- Nhập thủ công (Không chọn đơn hàng) --</option>
              {pendingOrders.map((order) => (
                <option key={order.id} value={order.id}>
                  [{order.order_code || order.id.slice(0, 8).toUpperCase()}] {order.customerName} - {order.total_amount_vnd?.toLocaleString("vi-VN")} đ
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                Số tiền (VND)
              </label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setAmount(isNaN(val) ? "" : val);
                  setSelectedOrderId("");
                }}
                placeholder="Ví dụ: 100000"
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                Nội dung (Memo)
              </label>
              <Input
                type="text"
                value={memo}
                onChange={(e) => {
                  setMemo(e.target.value);
                  setSelectedOrderId("");
                }}
                placeholder="Ví dụ: CK DONHANG"
                className="h-11"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border-soft)] bg-[var(--surface-light)]/50 p-4">
          {qrUrl ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="rounded-2xl border-2 border-white bg-white p-3 shadow-md">
                <img
                  src={qrUrl}
                  alt="VietQR Code"
                  className="size-48 object-contain"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={handleCopyLink}
                  className="flex items-center gap-1.5"
                >
                  {copiedLink ? <CheckCheck className="size-3.5 text-emerald-500" strokeWidth={3} /> : <Copy className="size-3.5" />}
                  Copy Link QR
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={handleCopyText}
                  className="flex items-center gap-1.5"
                >
                  {copiedText ? <CheckCheck className="size-3.5 text-emerald-500" strokeWidth={3} /> : <Copy className="size-3.5" />}
                  Copy Info CK
                </Button>
              </div>
              <p className="max-w-xs text-[11px] leading-5 text-[var(--fg-muted)] font-medium">
                Quét mã để chuyển khoản tự động nhận số tiền & nội dung.
              </p>
            </div>
          ) : (
            <div className="py-8 text-center">
              <QrCode className="mx-auto size-10 text-[var(--fg-muted)]/40 stroke-[1.5]" />
              <p className="mt-3 text-[12px] font-bold text-[var(--fg-muted)]">Vui lòng chọn nguồn ngân hàng</p>
              <p className="mt-1 text-[11px] text-[var(--fg-muted)]/70 max-w-[200px]">
                Nguồn thanh toán cần có tên ngân hàng & số tài khoản để sinh mã QR.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
