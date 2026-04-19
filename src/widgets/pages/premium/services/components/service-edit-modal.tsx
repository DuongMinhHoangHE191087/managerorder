"use client";

import { useState, useEffect } from "react";
import { X, Loader2, Globe } from "lucide-react";
import { appToast } from "@/shared/ui/app-toast";
import { motion, AnimatePresence } from "framer-motion";
import type { PremiumServiceType } from "@/lib/domain/premium-types";
import { Select } from "@/shared/ui/select";

interface ServiceEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (service: PremiumServiceType) => void;
  service: PremiumServiceType;
}

export function ServiceEditModal({
  isOpen,
  onClose,
  onSuccess,
  service,
}: ServiceEditModalProps) {
  const [name, setName] = useState(service.name);
  const [slug, setSlug] = useState(service.slug);
  const [category, setCategory] = useState(service.category || "other");
  const [description, setDescription] = useState(service.description || "");
  const [isActive, setIsActive] = useState(service.is_active);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(service.name);
      setSlug(service.slug);
      setCategory(service.category || "other");
      setDescription(service.description || "");
      setIsActive(service.is_active);
    }
  }, [isOpen, service]);

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName || !slug.trim()) { appToast.error("Vui lòng nhập tên và mã dịch vụ"); return; }
    setSaving(true);
    try {
      const payload = { 
        name: trimmedName, 
        slug: slug.trim(), 
        category, 
        description: description.trim(),
        is_active: isActive
      };
      
      const res = await fetch(`/api/premium/services/${service.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json() as { data?: PremiumServiceType; error?: string };
      if (!res.ok || !json.data) { appToast.error(json.error ?? "Lỗi cập nhật"); return; }
      
      appToast.success(`Đã cập nhật dịch vụ "${json.data.name}"!`);
      // Preserve local package_count context if API doesn't return it
      onSuccess({ ...json.data, package_count: service.package_count });
      onClose();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Lỗi cập nhật mạng";
      appToast.error(errorMsg);
    } finally { 
      setSaving(false); 
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: "rgba(15,23,42,0.45)", backdropFilter: "blur(4px)" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-[450px] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-[#1e293b] px-6 py-4 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-white font-bold text-[16px]">Cập nhật Dịch Vụ</h2>
                <p className="text-white/70 text-[12px] mt-0.5">Sửa đổi thông tin nền tảng</p>
              </div>
              <button onClick={onClose} className="size-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors">
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
                    className="w-full pl-9 pr-4 py-3 bg-[#f8f9fa] border border-[var(--border-soft)] rounded-xl text-[14px] font-medium outline-none focus:border-[var(--accent)] focus:bg-white transition-all placeholder:text-[var(--fg-muted)]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-widest">Mã (Slug) <span className="text-[var(--danger)]">*</span></label>
                <input value={slug} onChange={(e) => setSlug(e.target.value)} pattern="^[a-z0-9-]+$"
                  className="w-full px-4 py-3 bg-[#f8f9fa] border border-[var(--border-soft)] rounded-xl text-[14px] font-medium outline-none focus:border-[var(--accent)] focus:bg-white transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-widest">Danh mục</label>
                  <Select value={category} onChange={(e) => setCategory(e.target.value)} className="h-12 rounded-xl text-[14px] font-medium">
                    <option value="entertainment">Giải trí</option>
                    <option value="learning">Học tập</option>
                    <option value="productivity">Làm việc</option>
                    <option value="other">Khác</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-widest">Trạng thái</label>
                  <Select value={isActive ? "true" : "false"} onChange={(e) => setIsActive(e.target.value === "true")} className="h-12 rounded-xl text-[14px] font-medium">
                    <option value="true">Đang kinh doanh</option>
                    <option value="false">Tạm ngưng</option>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-widest">Mô tả ngắn</label>
                <input value={description} onChange={(e) => setDescription(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSave()}
                  className="w-full px-4 py-3 bg-[#f8f9fa] border border-[var(--border-soft)] rounded-xl text-[14px] font-medium outline-none focus:border-[var(--accent)] focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 pt-3 flex gap-3 border-t border-[var(--border-soft)] shrink-0 bg-white">
              <button type="button" onClick={onClose} className="flex-1 h-11 rounded-xl border border-[var(--border-soft)] text-[13px] font-bold text-[var(--fg-muted)] hover:bg-gray-50 transition-colors">
                Hủy
              </button>
              <button type="button" onClick={handleSave} disabled={saving || !name.trim() || !slug.trim()} className="flex-1 h-11 rounded-xl bg-[#1e293b] hover:bg-black text-white text-[13px] font-bold flex items-center justify-center gap-2 hover:shadow-md disabled:opacity-50 transition-all">
                {saving && <Loader2 className="size-4 animate-spin" />}
                {saving ? "Đang lưu..." : "Lưu Thay Đổi"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
