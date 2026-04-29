"use client";

import { useState } from "react";
import { Globe } from "lucide-react";
import { appToast } from "@/shared/ui/app-toast";
import type { PremiumServiceType } from "@/lib/domain/premium-types";
import {
  AdvancedOptionsDisclosure,
  CreateActionFooter,
  CreateFlowDialog,
  CreateFormSection,
} from "@/shared/ui/create-flow-shell";
import { Select } from "@/shared/ui/select";

interface ServiceCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (service: PremiumServiceType) => void;
}

const CATEGORY_OPTIONS = [
  { value: "entertainment", label: "Giải trí (Netflix, Spotify...)" },
  { value: "learning", label: "Học tập (Duolingo, Elsa...)" },
  { value: "productivity", label: "Làm việc (ChatGPT, Canva...)" },
  { value: "other", label: "Khác" },
] as const;

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
    <CreateFlowDialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Thêm dịch vụ Premium"
      description="Nguồn sự thật cho danh mục nền tảng, package mapping và các flow gia hạn hoặc migration."
      size="md"
      footer={
        <CreateActionFooter
          primaryLabel="Tạo dịch vụ"
          onPrimary={() => void handleSave()}
          onCancel={handleClose}
          pending={saving}
          disabled={!name.trim() || !slug.trim()}
        />
      }
    >
      <CreateFormSection
        title="Thông tin chính"
        description="Chỉ giữ các trường thực sự cần để mở bán và map với account/subscription."
      >
        <div className="grid gap-4">
          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
              Tên dịch vụ <span className="text-[var(--danger)]">*</span>
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--fg-muted)]" />
              <input
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && void handleSave()}
                placeholder="VD: Duolingo Super"
                className="w-full rounded-2xl border border-[var(--border-soft)] bg-white py-3 pl-10 pr-4 text-[14px] font-medium outline-none transition-all placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px]">
            <div className="space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                Mã nội bộ (slug) <span className="text-[var(--danger)]">*</span>
              </label>
              <input
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                pattern="^[a-z0-9-]+$"
                title="Chỉ chữ cái thường, số và gạch ngang"
                placeholder="vd: duolingo"
                className="w-full rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-3 text-[14px] font-medium outline-none transition-all focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
              />
              <p className="text-xs leading-6 text-[var(--fg-muted)]">Slug dùng để map service trong kho, thuê bao và báo cáo.</p>
            </div>

            <div className="space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Danh mục</label>
              <Select value={category} onChange={(event) => setCategory(event.target.value)} className="h-12 rounded-2xl text-[14px] font-medium">
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>
      </CreateFormSection>

      <AdvancedOptionsDisclosure>
        <div className="space-y-2">
          <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Mô tả ngắn</label>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            placeholder="Mô tả ngắn để vận hành biết đây là dịch vụ nào, dùng cho ai."
            className="w-full resize-none rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-3 text-[14px] font-medium outline-none transition-all placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
          />
        </div>
      </AdvancedOptionsDisclosure>
    </CreateFlowDialog>
  );
}
