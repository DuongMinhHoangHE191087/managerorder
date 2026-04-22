import { Bell, CalendarDays, CheckCircle2, Circle, Clock, AlignLeft, Trash2, User } from "lucide-react";
import { vi } from "@/shared/messages/vi";
import { Button } from "@/shared/ui/button";
import { Modal } from "@/shared/ui/modal";
import type { CalendarEvent } from "@/lib/domain/types";

interface EventViewModalProps {
  viewingEvent: CalendarEvent | null;
  setViewingEvent: (event: CalendarEvent | null) => void;
  setDeletingEvent: (event: CalendarEvent | null) => void;
  toggleEventDone: (event: CalendarEvent) => Promise<void>;
  typeColors: Record<string, string>;
}

export function EventViewModal({
  viewingEvent,
  setViewingEvent,
  setDeletingEvent,
  toggleEventDone,
  typeColors,
}: EventViewModalProps) {
  if (!viewingEvent) return null;

  const text = vi.calendar.eventDetail;
  const typeLabel =
    text.typeLabels[viewingEvent.type as keyof typeof text.typeLabels] ?? viewingEvent.type;

  return (
    <Modal
      isOpen={!!viewingEvent}
      onClose={() => setViewingEvent(null)}
      title={text.title}
      size="md"
      footer={
        <div className="flex w-full items-center justify-between">
          <Button
            variant="secondary"
            onClick={async () => {
              await toggleEventDone(viewingEvent);
              setViewingEvent({ ...viewingEvent, isDone: !viewingEvent.isDone } as CalendarEvent);
            }}
            className={`gap-2 border-2 ${
              viewingEvent.isDone
                ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] shadow-sm"
                : "border-[var(--border-soft)] hover:bg-[var(--surface-light)]"
            }`}
          >
            {viewingEvent.isDone ? <CheckCircle2 className="size-4" /> : <Circle className="size-4 opacity-50" />}
            <span className="font-bold">{viewingEvent.isDone ? text.done : text.markDone}</span>
          </Button>

          <Button
            variant="primary"
            onClick={() => {
              setDeletingEvent(viewingEvent);
              setViewingEvent(null);
            }}
            className="shrink-0 gap-2 border border-transparent !bg-[var(--danger)] !shadow-none hover:!bg-[var(--danger)]"
          >
            <Trash2 className="size-4" /> {text.delete}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="relative flex items-center justify-between overflow-hidden rounded-xl border border-[var(--accent)]/20 bg-gradient-to-r from-[var(--accent)]/5 to-transparent p-4 shadow-sm">
          <div className="pointer-events-none absolute bottom-0 right-0 top-0 w-24 bg-gradient-to-l from-[var(--accent)]/10 to-transparent" />
          <div className="flex items-center gap-3">
            <div className={`flex size-10 items-center justify-center rounded-full border-2 border-white shadow-sm ${typeColors[viewingEvent.type] ?? "bg-[var(--fg-muted)]"}`}>
              <CalendarDays className="size-4 text-white" />
            </div>
            <div>
              <h3 className="text-[16px] font-black leading-tight text-[var(--fg-base)]">{viewingEvent.title}</h3>
              <div className="mt-1 flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white bg-opacity-90 ${typeColors[viewingEvent.type] ?? "bg-gray-200"}`}>
                  {typeLabel}
                </span>
              </div>
            </div>
          </div>
        </div>

        {viewingEvent.customers.length > 0 && (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
              <User className="size-3" /> {text.linkedCustomers(viewingEvent.customers.length)}
            </p>
            <div className="space-y-1.5">
              {viewingEvent.customers.map((customer) => (
                <div
                  key={customer.id}
                  className="flex items-center gap-3 rounded-xl border border-[var(--border-soft)] bg-white p-2.5 shadow-sm"
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/10">
                    <span className="text-[12px] font-black text-[var(--accent)]">
                      {customer.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-[var(--fg-base)]">{customer.name}</p>
                    {customer.contact && (
                      <p className="flex items-center gap-1 truncate text-[11px] text-[var(--fg-muted)]">
                        <span className="inline-block size-1.5 rounded-full bg-[var(--accent)]/60" />
                        {customer.contact}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-light)] p-3">
            <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
              <CalendarDays className="size-3" /> {text.labels.date}
            </p>
            <p className="text-[14px] font-bold text-[var(--fg-base)]">{viewingEvent.date}</p>
          </div>
          <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-light)] p-3">
            <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
              <Clock className="size-3" /> {text.labels.time}
            </p>
            <p className="text-[14px] font-bold text-[var(--fg-base)]">{viewingEvent.time ?? text.labels.allDay}</p>
          </div>
        </div>

        {viewingEvent.notes && (
          <div className="rounded-xl border border-[var(--border-soft)] border-l-4 border-l-[var(--accent)] bg-[var(--surface-light)] p-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
              <AlignLeft className="size-3.5" /> {text.labels.internalNotes}
            </p>
            <div className="whitespace-pre-wrap pl-1 text-[13px] leading-relaxed text-[var(--fg-base)]">
              {viewingEvent.notes}
            </div>
          </div>
        )}

        {!viewingEvent.hasReminder && (
          <div className="rounded-lg border border-dashed border-[var(--border-soft)] bg-[var(--bg-app)]/50 p-2 text-center">
            <p className="flex items-center justify-center gap-1.5 text-[11px] font-medium text-[var(--fg-muted)]">
              <Bell className="size-3 opacity-50" /> {text.noReminder}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
