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

export function PaymentSourceManager() {
  const { data: sources = [], isLoading } = usePaymentSources();
  const { mutateAsync: createSource, isPending: creatingSource } = useCreatePaymentSource();
  const { mutateAsync: updateSource, isPending: updatingSource } = useUpdatePaymentSource();
  const { mutateAsync: deleteSource, isPending: deletingSource } = useDeletePaymentSource();

  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("💳");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("");

  async function handleAdd() {
    const trimmedName = newName.trim();
    if (!trimmedName) {
      appToast.error("Vui lòng nhập tên nguồn thanh toán");
      return;
    }

    try {
      const newSource = await createSource({ name: trimmedName, icon: newIcon || "💳" });
      setNewName("");
      setNewIcon("💳");
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
      await updateSource({ id, name: trimmedName, icon: editIcon || "💳" });
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
        description="Giữ danh mục gọn để order form, payment dialog và refund flow cùng dùng một nguồn dữ liệu thống nhất."
      >
        <div className="grid gap-3 md:grid-cols-[88px_minmax(0,1fr)_auto]">
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
              placeholder="VD: MoMo, MB Bank, Tiền mặt..."
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
              Thêm nguồn
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
              <div className="grid gap-3 md:grid-cols-[72px_minmax(0,1fr)_auto]">
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
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface-light)] text-[20px]">
                  {source.icon || <WalletCards className="size-5 text-[var(--fg-muted)]" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-black text-[var(--fg-base)]">{source.name}</div>
                  <div className="text-[12px] font-medium text-[var(--fg-muted)]">
                    Dùng cho order checkout, ghi nhận thanh toán và đối soát quỹ.
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
    </div>
  );
}
