"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Loader2, Star, ShieldCheck, Calendar, User } from "lucide-react";
import { appToast } from "@/shared/ui/app-toast";
import type { Provider, ContactInfo } from "@/lib/domain/types";
import { Modal } from "@/shared/ui/modal";

const DynamicContactListLazy = dynamic(
  () =>
    import("@/shared/ui/dynamic-contact-list").then((mod) => ({
      default: mod.DynamicContactList,
    })),
  {
    ssr: false,
    loading: () => <div className="h-28 rounded-xl bg-[var(--surface-light)] animate-pulse" />,
  }
);

interface ProviderEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (provider: Provider) => void;
  provider: Provider;
}

export function ProviderEditModal({
  isOpen,
  onClose,
  onSuccess,
  provider,
}: ProviderEditModalProps) {
  const [name, setName] = useState(provider.name);
  const [tier, setTier] = useState<"regular" | "vip">(provider.tier || "regular");
  const [reliabilityScore, setReliabilityScore] = useState(String(provider.reliabilityScore || 100));
  const [createdAt, setCreatedAt] = useState(provider.createdAt?.slice(0, 10) || new Date().toISOString().slice(0, 10));
  const [contacts, setContacts] = useState<ContactInfo[]>([]);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState(provider.notes || "");

  // Deep clone contacts with guaranteed IDs when modal opens
  useEffect(() => {
    if (isOpen) {
      setName(provider.name);
      setTier(provider.tier || "regular");
      setReliabilityScore(String(provider.reliabilityScore || 100));
      setCreatedAt(provider.createdAt?.slice(0, 10) || new Date().toISOString().slice(0, 10));
      setNotes(provider.notes || "");
      // Deep clone + ensure every contact has a unique ID
      const cloned = (provider.contacts ?? []).map(c => ({
        ...c,
        id: c.id || crypto.randomUUID(),
      }));
      setContacts(cloned.length > 0 ? cloned : []);
    }
  }, [isOpen, provider]);

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) { appToast.error("Vui lòng nhập tên nhà cung cấp"); return; }
    setSaving(true);
    try {
      const payload = {
        name: trimmedName,
        tier,
        reliabilityScore: Number(reliabilityScore),
        createdAt: new Date(createdAt).toISOString(),
        contacts: contacts.filter((c) => c.value.trim()),
        notes: notes.trim() || undefined,
      };
      const res = await fetch(`/api/providers/${provider.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json() as { data?: Provider; error?: string };
      if (!res.ok || !json.data) { appToast.error(json.error ?? "Lỗi cập nhật"); return; }
      
      appToast.success(`Đã cập nhật nhà cung cấp "${json.data.name}"!`);
      onSuccess(json.data);
      onClose();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Lỗi cập nhật";
      appToast.error(errorMsg);
    } finally { 
      setSaving(false); 
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cập nhật hồ sơ Nhà cung cấp"
      size="lg"
      footer={
        <div className="flex justify-end gap-3 w-full">
          <button type="button" onClick={onClose} className="px-6 py-2.5 rounded-xl border border-[var(--border-soft)] text-[13px] font-bold text-[var(--fg-muted)] hover:bg-gray-50 transition-colors">
            Hủy
          </button>
          <button type="button" onClick={handleSave} disabled={saving || !name.trim()} className="px-6 py-2.5 rounded-xl bg-[var(--accent)] text-white text-[13px] font-bold disabled:opacity-50 flex items-center gap-2 shadow-sm hover:opacity-90 transition-all">
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Basic Info */}
        <div className="space-y-2">
          <label className="block text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-widest">
            Tên đơn vị/cá nhân <span className="text-[var(--danger)]">*</span>
          </label>
          <input
            autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder="VD: Đối tác Netflix VIP"
            className="w-full h-11 px-4 bg-[#f8f9fa] border border-[var(--border-soft)] rounded-xl text-[14px] font-medium outline-none focus:border-[var(--accent)] focus:bg-white transition-all placeholder:text-[var(--fg-muted)] focus:ring-2 focus:ring-[var(--accent)]/20"
          />
        </div>

        {/* Categories */}
        <div>
          <label className="block text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-widest mb-3">Hạng nhà cung cấp</label>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setTier("regular")}
              className={`p-3 rounded-xl border-2 text-left transition-all flex flex-col gap-1.5 ${
                tier === "regular"
                  ? "border-[var(--accent)] bg-[var(--accent)]/10"
                  : "border-[var(--border-soft)] hover:border-[var(--accent)]/30"
              }`}
            >
              <div className="flex items-center gap-2">
                <User className={`size-4 ${tier === "regular" ? "text-[var(--accent)]" : "text-[var(--fg-muted)]"}`} />
                <p className={`text-[13px] font-bold leading-tight ${tier === "regular" ? "text-[var(--accent)]" : "text-[var(--fg-base)]"}`}>Hạng thường</p>
              </div>
              <p className="text-[11px] text-[var(--fg-muted)]">Cấp độ mặc định</p>
            </button>
            <button type="button" onClick={() => setTier("vip")}
              className={`p-3 rounded-xl border-2 text-left transition-all flex flex-col gap-1.5 ${
                tier === "vip"
                  ? "border-[#ff9500] bg-[#ff9500]/10"
                  : "border-[var(--border-soft)] hover:border-[#ff9500]/30"
              }`}
            >
              <div className="flex items-center gap-2">
                <Star className={`size-4 ${tier === "vip" ? "text-[#ff9500]" : "text-[var(--fg-muted)]"}`} />
                <p className={`text-[13px] font-bold leading-tight ${tier === "vip" ? "text-[#ff9500]" : "text-[var(--fg-base)]"}`}>Đối tác VIP</p>
              </div>
              <p className="text-[11px] text-[var(--fg-muted)]">Cung cấp nguồn đầu vào lớn</p>
            </button>
          </div>
        </div>

        {/* Contacts */}
        <div>
           <DynamicContactListLazy contacts={contacts} onChange={setContacts} title="Kênh liên lạc" description="Quản lý danh bạ liên hệ nhà cung cấp" />
        </div>

        {/* Extra Info Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-widest flex items-center gap-1.5 mb-2">
              <ShieldCheck className="size-3" />
              Điểm uy tín ({reliabilityScore}/100)
            </label>
            <input
              type="range" min={0} max={100} step={5}
              value={reliabilityScore}
              onChange={(e) => setReliabilityScore(e.target.value)}
              className="w-full h-2 rounded-full appearance-none cursor-pointer accent-[var(--accent)]"
              style={{
                background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${reliabilityScore}%, #e2e8f0 ${reliabilityScore}%, #e2e8f0 100%)`
              }}
            />
            <div className="flex justify-between text-[10px] text-[var(--fg-muted)] mt-1">
              <span>0 (Kém)</span>
              <span>100 (Uy tín)</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-widest flex items-center gap-1.5 mb-2">
              <Calendar className="size-3" />
              Ngày tạo
            </label>
            <input type="date" value={createdAt} onChange={(e) => setCreatedAt(e.target.value)}
              className="w-full h-11 px-4 bg-[#f8f9fa] border border-[var(--border-soft)] rounded-xl text-[13px] font-medium outline-none focus:border-[var(--accent)] focus:bg-white transition-all placeholder:text-[var(--fg-muted)] focus:ring-2 focus:ring-[var(--accent)]/20"
            />
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <label className="block text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-widest">Ghi chú</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Ghi chú về nhà cung cấp..."
            className="w-full px-4 py-3 bg-[#f8f9fa] border border-[var(--border-soft)] rounded-xl text-[14px] font-medium outline-none focus:border-[var(--accent)] focus:bg-white transition-all placeholder:text-[var(--fg-muted)] resize-none focus:ring-2 focus:ring-[var(--accent)]/20"
          />
        </div>
      </div>
    </Modal>
  );
}
