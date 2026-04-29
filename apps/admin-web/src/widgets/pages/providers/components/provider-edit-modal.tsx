"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Calendar, ShieldCheck, Star, User } from "lucide-react";

import { appToast } from "@/shared/ui/app-toast";
import {
  CreateActionFooter,
  CreateFlowDialog,
  CreateFormSection,
  AdvancedOptionsDisclosure,
} from "@/shared/ui/create-flow-shell";
import type { ContactInfo, Provider } from "@/lib/domain/types";
import { Input } from "@/shared/ui/input";
import { vi } from "@/shared/messages/vi";

const DynamicContactListLazy = dynamic(
  () =>
    import("@/shared/ui/dynamic-contact-list").then((mod) => ({
      default: mod.DynamicContactList,
    })),
  {
    ssr: false,
    loading: () => <div className="h-28 rounded-2xl bg-[var(--surface-light)] animate-pulse" />,
  },
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
  const text = vi.providers.editModal;
  const [name, setName] = useState(provider.name);
  const [tier, setTier] = useState<"regular" | "vip">(provider.tier || "regular");
  const [reliabilityScore, setReliabilityScore] = useState(String(provider.reliabilityScore || 100));
  const [createdAt, setCreatedAt] = useState(provider.createdAt?.slice(0, 10) || new Date().toISOString().slice(0, 10));
  const [contacts, setContacts] = useState<ContactInfo[]>([]);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState(provider.notes || "");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setName(provider.name);
    setTier(provider.tier || "regular");
    setReliabilityScore(String(provider.reliabilityScore || 100));
    setCreatedAt(provider.createdAt?.slice(0, 10) || new Date().toISOString().slice(0, 10));
    setNotes(provider.notes || "");
    setContacts((provider.contacts ?? []).map((contact) => ({
      ...contact,
      id: contact.id || crypto.randomUUID(),
    })));
  }, [isOpen, provider]);

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      appToast.error(text.validation.nameRequired);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: trimmedName,
        tier,
        reliabilityScore: Number(reliabilityScore),
        createdAt: new Date(createdAt).toISOString(),
        contacts: contacts.filter((contact) => contact.value.trim()),
        notes: notes.trim() || undefined,
      };

      const res = await fetch(`/api/providers/${provider.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { data?: Provider; error?: string };

      if (!res.ok || !json.data) {
        appToast.error(json.error ?? text.error.update);
        return;
      }

      appToast.success(text.success(json.data.name));
      onSuccess(json.data);
      onClose();
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : text.error.update;
      appToast.error(errorMsg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <CreateFlowDialog
      isOpen={isOpen}
      onClose={onClose}
      title={text.title}
      description="Cập nhật thông tin nhà cung cấp trong cùng một layout gọn, rộng và dễ nhập liệu."
      size="lg"
      footer={
        <CreateActionFooter
          primaryLabel={text.save}
          onPrimary={handleSave}
          onCancel={onClose}
          cancelLabel={text.cancel}
          pending={saving}
          disabled={saving || !name.trim()}
        />
      }
    >
      <div className="grid gap-5">
        <CreateFormSection
          title="Thông tin chính"
          description="Tên nhà cung cấp là trường bắt buộc. Các trường còn lại được tổ chức để nhập nhanh và dễ đọc."
        >
          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
              {text.nameLabel} <span className="text-[var(--danger)]">*</span>
            </label>
            <Input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleSave();
                }
              }}
              placeholder={text.namePlaceholder}
            />
          </div>
        </CreateFormSection>

        <CreateFormSection
          title="Phân loại và độ tin cậy"
          description="Chuyển đổi nhanh giữa khách thường và VIP, đồng thời giữ thang độ tin cậy rõ ràng."
        >
          <div>
            <label className="mb-3 block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
              {text.tierLabel}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTier("regular")}
                className={`flex flex-col gap-1.5 rounded-2xl border-2 p-4 text-left transition-all ${
                  tier === "regular"
                    ? "border-[var(--accent)] bg-[var(--accent)]/10"
                    : "border-[var(--border-soft)] hover:border-[var(--accent)]/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  <User className={`size-4 ${tier === "regular" ? "text-[var(--accent)]" : "text-[var(--fg-muted)]"}`} />
                  <p className={`text-[13px] font-bold leading-tight ${tier === "regular" ? "text-[var(--accent)]" : "text-[var(--fg-base)]"}`}>
                    {text.tier.regular.title}
                  </p>
                </div>
                <p className="text-[11px] text-[var(--fg-muted)]">{text.tier.regular.desc}</p>
              </button>

              <button
                type="button"
                onClick={() => setTier("vip")}
                className={`flex flex-col gap-1.5 rounded-2xl border-2 p-4 text-left transition-all ${
                  tier === "vip"
                    ? "border-[#ff9500] bg-[#ff9500]/10"
                    : "border-[var(--border-soft)] hover:border-[#ff9500]/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Star className={`size-4 ${tier === "vip" ? "text-[#ff9500]" : "text-[var(--fg-muted)]"}`} />
                  <p className={`text-[13px] font-bold leading-tight ${tier === "vip" ? "text-[#ff9500]" : "text-[var(--fg-base)]"}`}>
                    {text.tier.vip.title}
                  </p>
                </div>
                <p className="text-[11px] text-[var(--fg-muted)]">{text.tier.vip.desc}</p>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
              <ShieldCheck className="size-3" />
              {text.reliabilityLabel} ({reliabilityScore}/100)
            </label>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={reliabilityScore}
              onChange={(event) => setReliabilityScore(event.target.value)}
              className="h-2 w-full cursor-pointer rounded-full accent-[var(--accent)]"
              style={{
                background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${reliabilityScore}%, #e2e8f0 ${reliabilityScore}%, #e2e8f0 100%)`,
              }}
            />
            <div className="mt-1 flex justify-between text-[10px] text-[var(--fg-muted)]">
              <span>{text.reliabilityLow}</span>
              <span>{text.reliabilityHigh}</span>
            </div>
          </div>
        </CreateFormSection>

        <CreateFormSection
          title="Liên hệ"
          description="Danh sách kênh liên hệ được giữ cùng một chuẩn để dùng lại cho search, detail và các luồng automation."
        >
          <DynamicContactListLazy
            contacts={contacts}
            onChange={setContacts}
            title={text.contactTitle}
            description={text.contactDescription}
          />
        </CreateFormSection>

        <CreateFormSection
          title="Ghi chú"
          description="Ghi chú ngắn gọn giúp truy ngược lý do chỉnh sửa sau này."
        >
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={4}
            placeholder={text.notesPlaceholder}
            className="w-full resize-none rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-3 text-[14px] font-medium text-[var(--fg-base)] outline-none transition-all placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
          />
        </CreateFormSection>

        <AdvancedOptionsDisclosure title="Tùy chọn nâng cao">
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
              <Calendar className="size-3" />
              {text.createdAtLabel}
            </label>
            <Input
              type="date"
              value={createdAt}
              onChange={(event) => setCreatedAt(event.target.value)}
            />
          </div>
        </AdvancedOptionsDisclosure>
      </div>
    </CreateFlowDialog>
  );
}
