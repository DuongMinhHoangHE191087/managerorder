"use client";

import { useState } from "react";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { appToast } from "@/shared/ui/app-toast";
import { usePaymentSources, useCreatePaymentSource, useUpdatePaymentSource, useDeletePaymentSource } from "@/widgets/pages/settings/hooks/use-settings";

export function PaymentSourceManager() {
  const { data: sources = [], isLoading } = usePaymentSources();
  const { mutateAsync: createSource } = useCreatePaymentSource();
  const { mutateAsync: updateSource } = useUpdatePaymentSource();
  const { mutateAsync: deleteSource } = useDeletePaymentSource();

  const [newName, setNewName] = useState(""); const [newIcon, setNewIcon] = useState("💳");
  const [editId, setEditId] = useState<string | null>(null); const [editName, setEditName] = useState(""); const [editIcon, setEditIcon] = useState("");

  async function handleAdd() {
    if (!newName.trim()) return;
    const newSource = await createSource({ name: newName.trim(), icon: newIcon || "💳" });
    setNewName(""); setNewIcon("💳");
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

  if (isLoading) return <div className="py-4 text-center text-[13px] text-[var(--fg-muted)] animate-pulse">Đang tải...</div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input className="w-12 text-center text-[20px] border border-[var(--border-soft)] rounded-lg bg-white px-2 py-2 outline-none focus:border-[var(--accent)]" value={newIcon} onChange={e => setNewIcon(e.target.value)} placeholder="💳" maxLength={2} />
        <input className="flex-1 border border-[var(--border-soft)] rounded-lg bg-white px-3 py-2 text-[13px] font-medium outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAdd()} placeholder="Tên nguồn (VD: MoMo, MB Bank, Tiền mặt...)" />
        <button onClick={handleAdd} disabled={!newName.trim()} className="flex items-center gap-1.5 px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-[12px] font-bold disabled:opacity-40 hover:opacity-90 transition-opacity">
          <Plus className="size-4" />Thêm
        </button>
      </div>
      <div className="space-y-2">
        {sources.length === 0 && <p className="text-[13px] text-[var(--fg-muted)] italic text-center py-3">Chưa có nguồn thanh toán nào</p>}
        {sources.map(s => (
          <div key={s.id} className="flex items-center gap-3 p-3 bg-white border border-[var(--border-soft)] rounded-xl group hover:border-[var(--accent)]/30 transition-colors">
            {editId === s.id ? (
              <>
                <input className="w-10 text-center text-[18px] border border-[var(--border-soft)] rounded-lg bg-[var(--bg-app)] px-1 py-1 outline-none focus:border-[var(--accent)]" value={editIcon} onChange={e => setEditIcon(e.target.value)} maxLength={2} />
                <input className="flex-1 border border-[var(--border-soft)] rounded-lg bg-[var(--bg-app)] px-3 py-1.5 text-[13px] font-medium outline-none focus:border-[var(--accent)]" value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSaveEdit(s.id)} />
                <button onClick={() => handleSaveEdit(s.id)} className="text-[var(--accent)] hover:opacity-80"><Check className="size-4" /></button>
                <button onClick={() => setEditId(null)} className="text-[var(--fg-muted)] hover:text-[var(--danger)]"><X className="size-4" /></button>
              </>
            ) : (
              <>
                <span className="text-[20px]">{s.icon}</span>
                <span className="flex-1 font-bold text-[13px] text-[var(--fg-base)]">{s.name}</span>
                <button onClick={() => { setEditId(s.id); setEditName(s.name); setEditIcon(s.icon); }} className="opacity-0 group-hover:opacity-100 text-[var(--fg-muted)] hover:text-[var(--accent)] transition-all"><Pencil className="size-4" /></button>
                <button onClick={() => handleDelete(s.id)} className="opacity-0 group-hover:opacity-100 text-[var(--fg-muted)] hover:text-[var(--danger)] transition-all"><Trash2 className="size-4" /></button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
