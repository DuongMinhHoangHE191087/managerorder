import { Trash2 } from "lucide-react";
import { vi } from "@/shared/messages/vi";
import { Button } from "@/shared/ui/button";
import { Modal } from "@/shared/ui/modal";
import type { CalendarEvent } from "@/lib/domain/types";

interface EventDeleteModalProps {
  deletingEvent: CalendarEvent | null;
  setDeletingEvent: (event: CalendarEvent | null) => void;
  handleDelete: () => Promise<void>;
}

export function EventDeleteModal({
  deletingEvent,
  setDeletingEvent,
  handleDelete,
}: EventDeleteModalProps) {
  if (!deletingEvent) return null;

  const text = vi.calendar.eventDelete;

  return (
    <Modal
      isOpen={!!deletingEvent}
      onClose={() => setDeletingEvent(null)}
      title={text.title}
      size="sm"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeletingEvent(null)}>
            {text.cancel}
          </Button>
          <Button
            variant="primary"
            onClick={handleDelete}
            className="!bg-[var(--danger)] !shadow-none hover:!bg-[var(--danger)]"
          >
            {text.confirm}
          </Button>
        </div>
      }
    >
      <div className="py-4 text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-[var(--danger)]/10">
          <Trash2 className="size-7 text-[var(--danger)]" />
        </div>
        <p className="mb-2 text-[15px] font-bold text-[var(--fg-base)]">{text.question}</p>
        <p className="text-[13px] text-[var(--fg-muted)]">
          {text.body(deletingEvent.title)}
        </p>
      </div>
    </Modal>
  );
}
