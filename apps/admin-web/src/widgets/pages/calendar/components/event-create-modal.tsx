"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { AlignLeft, Bell, Calendar, Clock, Loader2, User, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { vi } from "@/shared/messages/vi";
import { appToast } from "@/shared/ui/app-toast";
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
  { ssr: false },
);

export type CreateEventResult = CalendarEvent & { id: string };

interface EventCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (event: CreateEventResult) => void;
  initialDate?: string;
  initialCustomerId?: string;
}

type EventType = "reminder" | "renewal" | "follow_up" | "meeting" | "payment";

export function EventCreateModal({
  isOpen,
  onClose,
  onSuccess,
  initialDate = "",
  initialCustomerId = "",
}: EventCreateModalProps) {
  const text = vi.calendar.eventCreate;
  const { data: customers = [] } = useCustomers();
  const { mutateAsync: createEvent } = useCreateCalendarEvent();

  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>(
    initialCustomerId ? [initialCustomerId] : [],
  );
  const [selectedType, setSelectedType] = useState<EventType>("reminder");
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(initialDate || new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [hasReminder, setHasReminder] = useState(true);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setSelectedCustomerIds(initialCustomerId ? [initialCustomerId] : []);
    setDate(initialDate || new Date().toISOString().slice(0, 10));
  }, [initialCustomerId, initialDate, isOpen]);

  const eventTypes = [
    { value: "reminder" as const, emoji: "📝", label: text.types.reminder, color: "border-blue-300 bg-blue-50 text-blue-600" },
    { value: "renewal" as const, emoji: "⏳", label: text.types.renewal, color: "border-amber-300 bg-amber-50 text-amber-600" },
    { value: "follow_up" as const, emoji: "📞", label: text.types.follow_up, color: "border-emerald-300 bg-emerald-50 text-emerald-600" },
    { value: "meeting" as const, emoji: "🤝", label: text.types.meeting, color: "border-rose-300 bg-rose-50 text-rose-600" },
    { value: "payment" as const, emoji: "💳", label: text.types.payment, color: "border-purple-300 bg-purple-50 text-purple-600" },
  ] as const;

  async function handleSave() {
    if (!title.trim()) {
      appToast.error(text.errors.titleRequired);
      return;
    }
    if (!date) {
      appToast.error(text.errors.dateRequired);
      return;
    }

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
      const response = await createEvent(body);
      const createdEvent = (response as { data?: CalendarEvent }).data ?? response;
      appToast.success(text.success((createdEvent as CalendarEvent).title));
      onSuccess(createdEvent as CreateEventResult);
      handleClose();
    } catch {
      appToast.error(text.errors.createFailed);
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

  const activeType = eventTypes.find((item) => item.value === selectedType)!;

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
              className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex shrink-0 items-center justify-between bg-gradient-to-r from-[var(--accent)] to-[var(--accent-strong)] px-6 py-4">
                <div>
                  <h2 className="flex items-center gap-2 text-[16px] font-bold text-white">
                    <span className="text-lg">{activeType.emoji}</span>
                    {text.title}
                  </h2>
                  <p className="mt-0.5 text-[12px] text-white/70">{text.subtitle}</p>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex size-8 items-center justify-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/30"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="flex-1 space-y-5 overflow-y-auto p-6">
                <div>
                  <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                    {text.labels.type} <span className="text-[var(--danger)]">*</span>
                  </label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {eventTypes.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setSelectedType(item.value)}
                        className={`flex flex-col items-center gap-1 rounded-xl border-2 p-2 transition-all ${
                          selectedType === item.value
                            ? `${item.color} border-current`
                            : "border-[var(--border-soft)] hover:border-[var(--accent)]/30"
                        }`}
                      >
                        <span className="text-base">{item.emoji}</span>
                        <span
                          className={`text-center text-[9px] font-bold leading-tight ${
                            selectedType === item.value ? "" : "text-[var(--fg-muted)]"
                          }`}
                        >
                          {item.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                    <AlignLeft className="mr-1 inline size-3" />
                    {text.labels.title} <span className="text-[var(--danger)]">*</span>
                  </label>
                  <input
                    autoFocus
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && handleSave()}
                    placeholder={text.placeholders.title}
                    className="w-full rounded-xl border border-[var(--border-soft)] bg-[#f8f9fa] px-4 py-3 text-[14px] font-medium outline-none transition-all placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)] focus:bg-white focus:ring-2 focus:ring-[var(--accent)]/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                      <Calendar className="mr-1 inline size-3" />
                      {text.labels.date} <span className="text-[var(--danger)]">*</span>
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                      className="w-full cursor-pointer rounded-xl border border-[var(--border-soft)] bg-[#f8f9fa] px-3 py-2.5 text-[13px] font-medium outline-none transition-all focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                      <Clock className="mr-1 inline size-3" />
                      {text.labels.time}
                    </label>
                    <input
                      type="time"
                      value={time}
                      onChange={(event) => setTime(event.target.value)}
                      className="w-full cursor-pointer rounded-xl border border-[var(--border-soft)] bg-[#f8f9fa] px-3 py-2.5 text-[13px] font-medium outline-none transition-all focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                    <User className="mr-1 inline size-3" />
                    {text.labels.customer} ({selectedCustomerIds.length})
                  </label>
                  <CustomerMiniCombobox
                    customers={customers}
                    value={selectedCustomerIds}
                    onChange={setSelectedCustomerIds}
                    onCreateNew={() => setIsCustomerModalOpen(true)}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                    {text.labels.notes}
                  </label>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder={text.placeholders.notes}
                    rows={3}
                    className="w-full resize-none rounded-xl border border-[var(--border-soft)] bg-[#f8f9fa] px-4 py-3 text-[13px] font-medium outline-none transition-all placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)] focus:bg-white focus:ring-2 focus:ring-[var(--accent)]/20"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setHasReminder((value) => !value)}
                  className={`flex w-full items-center justify-between rounded-xl border-2 p-3.5 text-left transition-all ${
                    hasReminder ? "border-[var(--accent)] bg-[var(--accent)]/5" : "border-[var(--border-soft)]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Bell className={`size-4 ${hasReminder ? "text-[var(--accent)]" : "text-[var(--fg-muted)]"}`} />
                    <div>
                      <p className="text-[13px] font-bold text-[var(--fg-base)]">{text.labels.reminder}</p>
                      <p className="text-[11px] text-[var(--fg-muted)]">{text.labels.reminderDescription}</p>
                    </div>
                  </div>
                  <div
                    className={`relative h-[22px] w-10 rounded-full transition-colors ${
                      hasReminder ? "bg-[var(--accent)]" : "bg-gray-200"
                    }`}
                  >
                    <div
                      className={`absolute top-[2px] size-[18px] rounded-full bg-white shadow transition-transform ${
                        hasReminder ? "translate-x-[18px]" : "translate-x-[2px]"
                      }`}
                    />
                  </div>
                </button>
              </div>

              <div className="shrink-0 border-t border-[var(--border-soft)] px-6 pb-6 pt-3">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="h-11 flex-1 rounded-xl border border-[var(--border-soft)] text-[13px] font-bold text-[var(--fg-muted)] transition-colors hover:bg-gray-50"
                  >
                    {text.buttons.cancel}
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || !title.trim() || !date}
                    className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--accent)] to-[var(--accent-strong)] text-[13px] font-bold text-white shadow-sm transition-all hover:shadow-md disabled:opacity-50"
                  >
                    {saving && <Loader2 className="size-4 animate-spin" />}
                    {saving ? text.buttons.saving : text.buttons.create}
                  </button>
                </div>
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
            setSelectedCustomerIds((current) => [...current, newCustomer.id]);
            setIsCustomerModalOpen(false);
          }}
          defaultEntityType="customer"
        />
      )}
    </>
  );
}
