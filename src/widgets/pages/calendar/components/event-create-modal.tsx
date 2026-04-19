"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  X, Loader2, Bell, Calendar, Clock, AlignLeft,
  User,
} from "lucide-react";
import { appToast } from "@/shared/ui/app-toast";
import { motion, AnimatePresence } from "framer-motion";
import type { CalendarEvent } from "@/lib/domain/types";
import type { CreateCustomerResult } from "@/shared/types/customers";
import { CustomerMiniCombobox } from "@/widgets/pages/calendar/components/customer-mini-combobox";
import { useCreateCalendarEvent } from "@/widgets/pages/calendar/hooks/use-calendar-events";
import { useCustomers } from "@/widgets/pages/customers/hooks/use-customers";

const CustomerCreateModalLazy = dynamic(
  () =>
    import("@/widgets/pages/customers/components/customer-create-modal").then((mod) => ({
      default: mod.CustomerCreateModal,
    })),
  { ssr: false }
);

/* ─── Types ─────────────────────────────────────────────────────────── */

export type CreateEventResult = CalendarEvent & { id: string };

interface EventCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (event: CreateEventResult) => void;
  /** Pre-fill the date field (ISO yyyy-MM-dd) */
  initialDate?: string;
  /** Pre-selected customer */
  initialCustomerId?: string;
}

/* ─── Constants ─────────────────────────────────────────────────────── */

const EVENT_TYPES = [
  { value: "reminder",  emoji: "📝", label: "Nhắc nhở",  color: "border-blue-300  bg-blue-50   text-blue-600"  },
  { value: "renewal",   emoji: "⏳", label: "Gia hạn",   color: "border-amber-300 bg-amber-50  text-amber-600" },
  { value: "follow_up", emoji: "📞", label: "Chăm sóc",  color: "border-emerald-300 bg-emerald-50 text-emerald-600" },
  { value: "meeting",   emoji: "🤝", label: "Cuộc hẹn",  color: "border-rose-300  bg-rose-50   text-rose-600"  },
  { value: "payment",   emoji: "💳", label: "Thu tiền",  color: "border-purple-300 bg-purple-50 text-purple-600" },
] as const;

type EventType = (typeof EVENT_TYPES)[number]["value"];

/* ─── Main Component ─────────────────────────────────────────────────── */

export function EventCreateModal({
  isOpen,
  onClose,
  onSuccess,
  initialDate = "",
  initialCustomerId = "",
}: EventCreateModalProps) {
  const { data: customers = [] } = useCustomers();
  const { mutateAsync: createEvent } = useCreateCalendarEvent();

  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>(
    initialCustomerId ? [initialCustomerId] : []
  );
  const [selectedType, setSelectedType] = useState<EventType>("reminder");
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(initialDate || new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [hasReminder, setHasReminder] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setSelectedCustomerIds(initialCustomerId ? [initialCustomerId] : []);
      setDate(initialDate || new Date().toISOString().slice(0, 10));
    }
  }, [isOpen, initialDate, initialCustomerId]);

  async function handleSave() {
    if (!title.trim()) { appToast.error("Vui lòng nhập tiêu đề sự kiện"); return; }
    if (!date) { appToast.error("Vui lòng chọn ngày"); return; }
    setSaving(true);
    try {
      const body = {
        title: title.trim(),
        date,
        time: time || undefined,
        notes: notes.trim() || undefined,
        type: selectedType,
        customerIds: selectedCustomerIds.length > 0 ? selectedCustomerIds : undefined,
        hasReminder,
      };
      const res = await createEvent(body);
      // res may be CalendarMutationResponse (with .data) or CalendarEvent directly
      const createdEvent = (res as { data?: CalendarEvent }).data ?? res;
      appToast.success(`Đã tạo sự kiện "${(createdEvent as CalendarEvent).title}"!`);
      onSuccess(createdEvent as CreateEventResult);
      handleClose();
    } catch {
      appToast.error("Lỗi tạo sự kiện");
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    setTitle("");
    setSelectedType("reminder");
    setSelectedCustomerIds(initialCustomerId ? [initialCustomerId] : []);
    setDate(initialDate || new Date().toISOString().slice(0, 10));
    setTime("");
    setNotes("");
    setHasReminder(true);
    onClose();
  }

  const activeType = EVENT_TYPES.find((t) => t.value === selectedType)!;

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            style={{ background: "rgba(15,23,42,0.45)", backdropFilter: "blur(4px)" }}
            onClick={handleClose}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[92vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-[var(--accent)] to-[var(--accent-strong)] px-6 py-4 flex items-center justify-between shrink-0">
                <div>
                  <h2 className="text-white font-bold text-[16px] flex items-center gap-2">
                    <span className="text-lg">{activeType.emoji}</span>
                    Thêm sự kiện mới
                  </h2>
                  <p className="text-white/70 text-[12px] mt-0.5">Lịch CRM &amp; nhắc nhở</p>
                </div>
                <button
                  onClick={handleClose}
                  className="size-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-colors"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Body – scrollable */}
              <div className="p-6 space-y-5 overflow-y-auto flex-1">
                {/* Event Type */}
                <div>
                  <label className="block text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-widest mb-2">
                    Loại sự kiện <span className="text-[var(--danger)]">*</span>
                  </label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {EVENT_TYPES.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setSelectedType(t.value)}
                        className={`p-2 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${
                          selectedType === t.value
                            ? `${t.color} border-current`
                            : "border-[var(--border-soft)] hover:border-[var(--accent)]/30"
                        }`}
                      >
                        <span className="text-base">{t.emoji}</span>
                        <span className={`text-[9px] font-bold leading-tight text-center ${selectedType === t.value ? "" : "text-[var(--fg-muted)]"}`}>
                          {t.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-widest mb-2">
                    <AlignLeft className="inline size-3 mr-1" />
                    Tiêu đề <span className="text-[var(--danger)]">*</span>
                  </label>
                  <input
                    autoFocus
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSave()}
                    placeholder="VD: Gọi điện cho anh Long về gia hạn..."
                    className="w-full px-4 py-3 bg-[#f8f9fa] border border-[var(--border-soft)] rounded-xl text-[14px] font-medium outline-none focus:border-[var(--accent)] focus:bg-white transition-all placeholder:text-[var(--fg-muted)] focus:ring-2 focus:ring-[var(--accent)]/20"
                  />
                </div>

                {/* Date & Time row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-widest mb-2">
                      <Calendar className="inline size-3 mr-1" />
                      Ngày <span className="text-[var(--danger)]">*</span>
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-3 py-2.5 bg-[#f8f9fa] border border-[var(--border-soft)] rounded-xl text-[13px] font-medium outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 transition-all cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-widest mb-2">
                      <Clock className="inline size-3 mr-1" />
                      Giờ (tùy chọn)
                    </label>
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="w-full px-3 py-2.5 bg-[#f8f9fa] border border-[var(--border-soft)] rounded-xl text-[13px] font-medium outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 transition-all cursor-pointer"
                    />
                  </div>
                </div>

                {/* Customer */}
                <div>
                  <label className="block text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-widest mb-2">
                    <User className="inline size-3 mr-1" />
                    Liên kết khách hàng ({selectedCustomerIds.length})
                  </label>
                    <CustomerMiniCombobox
                      customers={customers}
                      value={selectedCustomerIds}
                      onChange={setSelectedCustomerIds}
                      onCreateNew={() => setIsCustomerModalOpen(true)}
                    />
                  </div>

                {/* Notes */}
                <div>
                  <label className="block text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-widest mb-2">
                    Ghi chú
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Thêm ghi chú hoặc mô tả..."
                    rows={3}
                    className="w-full px-4 py-3 bg-[#f8f9fa] border border-[var(--border-soft)] rounded-xl text-[13px] font-medium outline-none focus:border-[var(--accent)] focus:bg-white transition-all placeholder:text-[var(--fg-muted)] resize-none focus:ring-2 focus:ring-[var(--accent)]/20"
                  />
                </div>

                {/* Reminder toggle */}
                <div
                  className={`flex items-center justify-between p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                    hasReminder ? "border-[var(--accent)] bg-[var(--accent)]/5" : "border-[var(--border-soft)]"
                  }`}
                  onClick={() => setHasReminder((v) => !v)}
                >
                  <div className="flex items-center gap-2">
                    <Bell className={`size-4 ${hasReminder ? "text-[var(--accent)]" : "text-[var(--fg-muted)]"}`} />
                    <div>
                      <p className="text-[13px] font-bold text-[var(--fg-base)]">Bật nhắc nhở</p>
                      <p className="text-[11px] text-[var(--fg-muted)]">Nhận thông báo trước sự kiện</p>
                    </div>
                  </div>
                  <div className={`w-10 h-5.5 rounded-full transition-colors relative ${hasReminder ? "bg-[var(--accent)]" : "bg-gray-200"}`}
                    style={{ height: 22 }}>
                    <div className={`absolute top-0.5 size-4.5 bg-white rounded-full shadow transition-transform ${hasReminder ? "translate-x-5" : "translate-x-0.5"}`}
                      style={{ width: 18, height: 18, left: 2, transform: hasReminder ? "translateX(18px)" : "translateX(0)" }}
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 pb-6 pt-3 flex gap-3 border-t border-[var(--border-soft)] shrink-0">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 h-11 rounded-xl border border-[var(--border-soft)] text-[13px] font-bold text-[var(--fg-muted)] hover:bg-gray-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !title.trim() || !date}
                  className="flex-1 h-11 rounded-xl bg-gradient-to-r from-[var(--accent)] to-[var(--accent-strong)] text-white text-[13px] font-bold disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all"
                >
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  {saving ? "Đang lưu..." : "Tạo sự kiện"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {isCustomerModalOpen && (
        <CustomerCreateModalLazy
          isOpen={isCustomerModalOpen}
          onClose={() => setIsCustomerModalOpen(false)}
          onSuccess={(newCustomer: CreateCustomerResult) => {
            setSelectedCustomerIds(prev => [...prev, newCustomer.id]);
            setIsCustomerModalOpen(false);
          }}
          defaultEntityType="customer"
        />
      )}
    </>
  );
}
