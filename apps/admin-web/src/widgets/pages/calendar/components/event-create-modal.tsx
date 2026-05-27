"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { AlignLeft, Bell, Calendar, Clock, User } from "lucide-react";
import { vi } from "@/shared/messages/vi";
import { appToast } from "@/shared/ui/app-toast";
import type { CalendarEvent } from "@/lib/domain/types";
import { formatDateKey } from "@/lib/utils";
import type { CreateCustomerResult } from "@/shared/types/customers";
import {
  AdvancedOptionsDisclosure,
  CreateActionFooter,
  CreateFlowDialog,
  CreateFormSection,
} from "@/shared/ui/create-flow-shell";
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
  const defaultDate = initialDate || formatDateKey(new Date());
  const { data: customers = [] } = useCustomers();
  const { mutateAsync: createEvent } = useCreateCalendarEvent();

  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>(
    initialCustomerId ? [initialCustomerId] : [],
  );
  const [selectedType, setSelectedType] = useState<EventType>("reminder");
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [hasReminder, setHasReminder] = useState(true);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setSelectedCustomerIds(initialCustomerId ? [initialCustomerId] : []);
    setDate(initialDate || formatDateKey(new Date()));
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
    setDate(initialDate || formatDateKey(new Date()));
    setTime("");
    setNotes("");
    setHasReminder(true);
    onClose();
  }

  return (
    <>
      <CreateFlowDialog
        isOpen={isOpen}
        onClose={handleClose}
        title={text.title}
        description={text.subtitle}
        size="lg"
        footer={
          <CreateActionFooter
            primaryLabel={text.buttons.create}
            onPrimary={() => void handleSave()}
            onCancel={handleClose}
            cancelLabel={text.buttons.cancel}
            pending={saving}
            disabled={!title.trim() || !date}
          />
        }
      >
        <CreateFormSection
          title="Loại sự kiện"
          description="Chọn đúng loại để lịch, dashboard và flow nhắc việc dùng chung một contract hiển thị."
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {eventTypes.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={selectedType === item.value}
                onClick={() => setSelectedType(item.value)}
                className={`flex min-h-[86px] flex-col items-start gap-2 rounded-2xl border px-4 py-3 text-left transition-[background-color,border-color,box-shadow,color] ${
                  selectedType === item.value
                    ? `${item.color} border-current shadow-sm`
                    : "border-[var(--border-soft)] bg-white hover:border-[var(--accent)]/30"
                }`}
              >
                <span className="text-lg">{item.emoji}</span>
                <span
                  className={`text-sm font-black leading-tight ${
                    selectedType === item.value ? "" : "text-[var(--fg-base)]"
                  }`}
                >
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </CreateFormSection>

        <CreateFormSection
          title="Thông tin chính"
          description="Giữ title, ngày và giờ thật rõ để tạo nhanh từ lịch hoặc từ các flow bán hàng."
        >
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(240px,0.7fr)_minmax(220px,0.7fr)]">
            <div className="space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                <AlignLeft className="mr-1 inline size-3" />
                {text.labels.title} <span className="text-[var(--danger)]">*</span>
              </label>
              <input
                autoFocus
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && void handleSave()}
                placeholder={text.placeholders.title}
                className="w-full rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-3 text-[14px] font-medium outline-none transition-[border-color,box-shadow] placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                <Calendar className="mr-1 inline size-3" />
                {text.labels.date} <span className="text-[var(--danger)]">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="w-full cursor-pointer rounded-2xl border border-[var(--border-soft)] bg-white px-3 py-3 text-[13px] font-medium outline-none transition-[border-color,box-shadow] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                <Clock className="mr-1 inline size-3" />
                {text.labels.time}
              </label>
              <input
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                className="w-full cursor-pointer rounded-2xl border border-[var(--border-soft)] bg-white px-3 py-3 text-[13px] font-medium outline-none transition-[border-color,box-shadow] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
              />
            </div>
          </div>
        </CreateFormSection>

        <CreateFormSection
          title="Liên kết khách hàng"
          description="Có thể gắn ngay nhiều khách hàng hoặc tạo nhanh hồ sơ mới mà không rời lịch."
        >
          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
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
        </CreateFormSection>

        <AdvancedOptionsDisclosure title="Tùy chọn nhắc việc">
          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
              {text.labels.notes}
            </label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={text.placeholders.notes}
              rows={4}
              className="w-full resize-none rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-3 text-[13px] font-medium outline-none transition-[border-color,box-shadow] placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
            />
          </div>

          <button
            type="button"
            aria-pressed={hasReminder}
            onClick={() => setHasReminder((value) => !value)}
            className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-[background-color,border-color] ${
              hasReminder ? "border-[var(--accent)] bg-[var(--accent)]/5" : "border-[var(--border-soft)] bg-[var(--surface-light)]/35"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`rounded-2xl p-2 ${hasReminder ? "bg-white text-[var(--accent)]" : "bg-white text-[var(--fg-muted)]"}`}>
                <Bell className="size-4" />
              </div>
              <div>
                <p className="text-sm font-black text-[var(--fg-base)]">{text.labels.reminder}</p>
                <p className="text-xs leading-6 text-[var(--fg-muted)]">{text.labels.reminderDescription}</p>
              </div>
            </div>
            <div
              className={`relative h-[22px] w-10 rounded-full transition-colors ${
                hasReminder ? "bg-[var(--accent)]" : "bg-slate-300"
              }`}
            >
              <div
                className={`absolute top-[2px] size-[18px] rounded-full bg-white shadow transition-transform ${
                  hasReminder ? "translate-x-[18px]" : "translate-x-[2px]"
                }`}
              />
            </div>
          </button>
        </AdvancedOptionsDisclosure>
      </CreateFlowDialog>

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
