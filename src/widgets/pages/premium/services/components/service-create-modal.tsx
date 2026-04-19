"use client";

import { useState } from "react";
import { X, Loader2, Globe } from "lucide-react";
import { appToast } from "@/shared/ui/app-toast";
import { motion, AnimatePresence } from "framer-motion";
import type { PremiumServiceType } from "@/lib/domain/premium-types";
import { Select } from "@/shared/ui/select";

interface ServiceCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (service: PremiumServiceType) => void;
}

export function ServiceCreateModal({
  isOpen,
  onClose,
  onSuccess,
}: ServiceCreateModalProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [category, setCategory] = useState("entertainment");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName || !slug.trim()) { appToast.error("Vui lòng nhập tên và mã dịch vụ"); return; }
    setSaving(true);
    try {
      const payload = { name: trimmedName, slug: slug.trim(), category, description: description.trim() };
      
      const res = await fetch("/api/premium/services", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json() as { data?: PremiumServiceType; error?: string };
      if (!res.ok || !json.data) { appToast.error(json.error ?? "Lỗi tạo mới"); return; }
      
      appToast.success(`Đã tạo dịch vụ "${json.data.name}"!`);
      onSuccess(json.data);
      handleClose();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Lỗi kết nối mạng";
      appToast.error(errorMsg);
    } finally { 
      setSaving(false); 
    }
  }

  function handleClose() {
    setName(""); setSlug(""); setCategory("entertainment"); setDescription("");
    onClose();
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: "rgba(15,23,42,0.45)", backdropFilter: "blur(4px)" }}
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-[450px] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-[var(--accent)] to-[var(--accent-strong)] px-6 py-4 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-white font-bold text-[16px]">Thêm Dịch Vụ Mới</h2>
                <p className="text-white/70 text-[12px] mt-0.5">Nền tảng Premium (Netflix, Duolingo...)</p>
              </div>
              <button onClick={handleClose} className="size-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-colors">
                <X className="size-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-widest">Tên dịch vụ <span className="text-[var(--danger)]">*</span></label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--fg-muted)]" />
                  <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSave()}
                    placeholder="VD: Duolingo Super"
                    className="w-full pl-9 pr-4 py-3 bg-[#f8f9fa] border border-[var(--border-soft)] rounded-xl text-[14px] font-medium outline-none focus:border-[var(--accent)] focus:bg-white transition-all placeholder:text-[var(--fg-muted)]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-widest">Mã (Slug) <span className="text-[var(--danger)]">*</span></label>
                <input value={slug} onChange={(e) => setSlug(e.target.value)} pattern="^[a-z0-9-]+$" title="Chỉ chữ cái thường, số và gạch ngang"
                  placeholder="vd: duolingo"
                  className="w-full px-4 py-3 bg-[#f8f9fa] border border-[var(--border-soft)] rounded-xl text-[14px] font-medium outline-none focus:border-[var(--accent)] focus:bg-white transition-all"
                />
                <p className="text-[10px] text-[var(--fg-muted)] mt-1 ml-1 pl-2 border-l-2 border-[var(--border-soft)]">Định danh nội bộ trên hệ thống, không dùng dấu cách / có dấu.</p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-widest">Danh mục</label>
                <Select value={category} onChange={(e) => setCategory(e.target.value)} className="h-12 rounded-xl text-[14px] font-medium">
                  <option value="entertainment">Giải trí (Netflix, Spotify...)</option>
                  <option value="learning">Học tập (Duolingo, Elsa...)</option>
                  <option value="productivity">Làm việc (ChatGPT, Canva...)</option>
                  <option value="other">Khác</option>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-widest">Mô tả ngắn</label>
                <input value={description} onChange={(e) => setDescription(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSave()}
                  placeholder="Mô tả về dịch vụ này"
                  className="w-full px-4 py-3 bg-[#f8f9fa] border border-[var(--border-soft)] rounded-xl text-[14px] font-medium outline-none focus:border-[var(--accent)] focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 pt-3 flex gap-3 border-t border-[var(--border-soft)] shrink-0 bg-white">
              <button type="button" onClick={handleClose} className="flex-1 h-11 rounded-xl border border-[var(--border-soft)] text-[13px] font-bold text-[var(--fg-muted)] hover:bg-gray-50 transition-colors">
                Hủy
              </button>
              <button type="button" onClick={handleSave} disabled={saving || !name.trim() || !slug.trim()} className="flex-1 h-11 rounded-xl bg-gradient-to-r from-[var(--accent)] to-[var(--accent-strong)] text-white text-[13px] font-bold flex items-center justify-center gap-2 hover:shadow-md disabled:opacity-50 transition-all">
                {saving && <Loader2 className="size-4 animate-spin" />}
                {saving ? "Đang tạo..." : "Tạo Dịch Vụ"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
