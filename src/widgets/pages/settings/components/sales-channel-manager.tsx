"use client";

import { useState } from "react";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { appToast } from "@/shared/ui/app-toast";
import { useSalesChannels, useCreateSalesChannel, useUpdateSalesChannel, useDeleteSalesChannel } from "@/widgets/pages/settings/hooks/use-settings";

export function SalesChannelManager() {
  const { data: channels = [], isLoading } = useSalesChannels();
  const { mutateAsync: createChannel } = useCreateSalesChannel();
  const { mutateAsync: updateChannel } = useUpdateSalesChannel();
  const { mutateAsync: deleteChannel } = useDeleteSalesChannel();

  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<string | null>(null); const [editName, setEditName] = useState("");

  async function handleAdd() {
    if (!newName.trim()) return;
    const newChannel = await createChannel({ name: newName.trim() });
    setNewName("");
    appToast.success(`Đã thêm: ${newChannel.name}`);
  }

  async function handleDelete(id: string) {
    await deleteChannel(id);
    appToast.success("Đã xoá kênh bán hàng");
  }

  async function handleSaveEdit(id: string) {
    await updateChannel({ id, name: editName });
    setEditId(null);
    appToast.success("Đã cập nhật");
  }

  if (isLoading) return <div className="py-4 text-center text-[13px] text-[var(--fg-muted)] animate-pulse">Đang tải...</div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input className="flex-1 border border-[var(--border-soft)] rounded-lg bg-white px-3 py-2 text-[13px] font-medium outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAdd()} placeholder="Tên kênh bán (VD: Facebook, Zalo, TikTok Shop...)" />
        <button onClick={handleAdd} disabled={!newName.trim()} className="flex items-center gap-1.5 px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-[12px] font-bold disabled:opacity-40 hover:opacity-90 transition-opacity">
          <Plus className="size-4" />Thêm
        </button>
      </div>
      <div className="space-y-2">
        {channels.length === 0 && <p className="text-[13px] text-[var(--fg-muted)] italic text-center py-3">Chưa có kênh bán hàng nào</p>}
        {channels.map(c => (
          <div key={c.id} className="flex items-center gap-3 p-3 bg-white border border-[var(--border-soft)] rounded-xl group hover:border-[var(--accent)]/30 transition-colors">
            {editId === c.id ? (
              <>
                <input className="flex-1 border border-[var(--border-soft)] rounded-lg bg-[var(--bg-app)] px-3 py-1.5 text-[13px] font-medium outline-none focus:border-[var(--accent)]" value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSaveEdit(c.id)} />
                <button onClick={() => handleSaveEdit(c.id)} className="text-[var(--accent)] hover:opacity-80"><Check className="size-4" /></button>
                <button onClick={() => setEditId(null)} className="text-[var(--fg-muted)] hover:text-[var(--danger)]"><X className="size-4" /></button>
              </>
            ) : (
              <>
                <span className="flex-1 font-bold text-[13px] text-[var(--fg-base)]">{c.name}</span>
                <button onClick={() => { setEditId(c.id); setEditName(c.name); }} className="opacity-0 group-hover:opacity-100 text-[var(--fg-muted)] hover:text-[var(--accent)] transition-all"><Pencil className="size-4" /></button>
                <button onClick={() => handleDelete(c.id)} className="opacity-0 group-hover:opacity-100 text-[var(--fg-muted)] hover:text-[var(--danger)] transition-all"><Trash2 className="size-4" /></button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
