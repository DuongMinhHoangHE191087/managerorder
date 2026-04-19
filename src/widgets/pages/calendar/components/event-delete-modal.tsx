import { Button } from "@/shared/ui/button";
import { Modal } from "@/shared/ui/modal";
import { Trash2 } from "lucide-react";
import type { CalendarEvent } from "@/lib/domain/types";

interface EventDeleteModalProps {
  deletingEvent: CalendarEvent | null;
  setDeletingEvent: (event: CalendarEvent | null) => void;
  handleDelete: () => Promise<void>;
}

export function EventDeleteModal({ deletingEvent, setDeletingEvent, handleDelete }: EventDeleteModalProps) {
  if (!deletingEvent) return null;

  return (
    <Modal
      isOpen={!!deletingEvent}
      onClose={() => setDeletingEvent(null)}
      title="Xác nhận xóa"
      size="sm"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeletingEvent(null)}>Hủy</Button>
          <Button
            variant="primary"
            onClick={handleDelete}
            className="!bg-[var(--danger)] hover:!bg-[var(--danger)] !shadow-none"
          >
            Xóa vĩnh viễn
          </Button>
        </div>
      }
    >
      <div className="text-center py-4">
        <div className="size-14 bg-[var(--danger)]/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Trash2 className="size-7 text-[var(--danger)]" />
        </div>
        <p className="text-[15px] font-bold text-[var(--fg-base)] mb-2">Bạn chắc chắn muốn xóa?</p>
        <p className="text-[13px] text-[var(--fg-muted)]">
          Sự kiện{" "}
          <span className="font-bold text-[var(--fg-base)]">&ldquo;{deletingEvent?.title}&rdquo;</span>{" "}
          sẽ bị xóa vĩnh viễn.
        </p>
      </div>
    </Modal>
  );
}
