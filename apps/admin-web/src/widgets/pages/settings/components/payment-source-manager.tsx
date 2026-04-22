"use client";

import { useState } from "react";
import { Check, Copy, Pencil, Plus, Trash2, X } from "lucide-react";
import { appToast } from "@/shared/ui/app-toast";
import {
  useCreatePaymentSource,
  useDeletePaymentSource,
  usePaymentSources,
  useUpdatePaymentSource,
} from "@/widgets/pages/settings/hooks/use-settings";

export function PaymentSourceManager() {
  const { data: sources = [], isLoading } = usePaymentSources();
  const { mutateAsync: createSource } = useCreatePaymentSource();
  const { mutateAsync: updateSource } = useUpdatePaymentSource();
  const { mutateAsync: deleteSource } = useDeletePaymentSource();

  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("💳");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("");

  async function handleAdd() {
    if (!newName.trim()) return;

    const newSource = await createSource({ name: newName.trim(), icon: newIcon || "💳" });
    setNewName("");
    setNewIcon("💳");
    appToast.success(`Đã thêm: ${newSource.name}`);
  }

  async function handleDelete(id: string) {
    await deleteSource(id);
    appToast.success("Đã xoá nguồn thanh toán");
  }

  async function handleSaveEdit(id: string) {
    await updateSource({ id, name: editName, icon: editIcon });
    setEditId(null);
    appToast.success("Đã cập nhật");
  }

  if (isLoading) {
    return <div className="py-4 text-center text-[13px] text-[var(--fg-muted)] animate-pulse">Đang tải...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          className="w-12 rounded-lg border border-[var(--border-soft)] bg-white px-2 py-2 text-center text-[20px] outline-none focus:border-[var(--accent)]"
          value={newIcon}
          onChange={(event) => setNewIcon(event.target.value)}
          placeholder="💳"
          maxLength={2}
        />
        <input
          className="flex-1 rounded-lg border border-[var(--border-soft)] bg-white px-3 py-2 text-[13px] font-medium outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && handleAdd()}
          placeholder="Tên nguồn (VD: MoMo, MB Bank, Tiền mặt...)"
        />
        <button
          onClick={handleAdd}
          disabled={!newName.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2 text-[12px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <Plus className="size-4" />
          Thêm
        </button>
      </div>

      <div className="space-y-2">
        {sources.length === 0 ? (
          <p className="py-3 text-center text-[13px] italic text-[var(--fg-muted)]">Chưa có nguồn thanh toán nào</p>
        ) : null}

        {sources.map((source) => (
          <div
            key={source.id}
            className="group flex items-center gap-3 rounded-xl border border-[var(--border-soft)] bg-white p-3 transition-colors hover:border-[var(--accent)]/30"
          >
            {editId === source.id ? (
              <>
                <input
                  className="w-10 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-app)] px-1 py-1 text-center text-[18px] outline-none focus:border-[var(--accent)]"
                  value={editIcon}
                  onChange={(event) => setEditIcon(event.target.value)}
                  maxLength={2}
                />
                <input
                  className="flex-1 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-app)] px-3 py-1.5 text-[13px] font-medium outline-none focus:border-[var(--accent)]"
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && handleSaveEdit(source.id)}
                />
                <button onClick={() => handleSaveEdit(source.id)} className="text-[var(--accent)] hover:opacity-80">
                  <Check className="size-4" />
                </button>
                <button onClick={() => setEditId(null)} className="text-[var(--fg-muted)] hover:text-[var(--danger)]">
                  <X className="size-4" />
                </button>
              </>
            ) : (
              <>
                <span className="text-[20px]">{source.icon}</span>
                <span className="flex-1 text-[13px] font-bold text-[var(--fg-base)]">{source.name}</span>
                <button
                  onClick={() => {
                    setEditId(source.id);
                    setEditName(source.name);
                    setEditIcon(source.icon);
                  }}
                  className="opacity-0 transition-all group-hover:opacity-100 text-[var(--fg-muted)] hover:text-[var(--accent)]"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  onClick={() => handleDelete(source.id)}
                  className="opacity-0 transition-all group-hover:opacity-100 text-[var(--fg-muted)] hover:text-[var(--danger)]"
                >
                  <Trash2 className="size-4" />
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
