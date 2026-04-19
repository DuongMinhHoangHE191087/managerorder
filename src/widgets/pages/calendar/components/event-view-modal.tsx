import { Button } from "@/shared/ui/button";
import { Modal } from "@/shared/ui/modal";
import { CheckCircle2, Circle, Trash2, CalendarDays, User, Clock, AlignLeft, Bell } from "lucide-react";
import type { CalendarEvent } from "@/lib/domain/types";

interface EventViewModalProps {
  viewingEvent: CalendarEvent | null;
  setViewingEvent: (event: CalendarEvent | null) => void;
  setDeletingEvent: (event: CalendarEvent | null) => void;
  toggleEventDone: (event: CalendarEvent) => Promise<void>;
  typeColors: Record<string, string>;
}

export function EventViewModal({ viewingEvent, setViewingEvent, setDeletingEvent, toggleEventDone, typeColors }: EventViewModalProps) {
  if (!viewingEvent) return null;

  return (
    <Modal
      isOpen={!!viewingEvent}
      onClose={() => setViewingEvent(null)}
      title="Chi tiết Sự kiện"
      size="md"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button
            variant="secondary"
            onClick={async () => {
              await toggleEventDone(viewingEvent);
              setViewingEvent({ ...viewingEvent, isDone: !viewingEvent.isDone } as CalendarEvent);
            }}
            className={`gap-2 border-2 ${viewingEvent.isDone ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] shadow-sm" : "border-[var(--border-soft)] hover:bg-[var(--surface-light)]"}`}
          >
            {viewingEvent.isDone ? <CheckCircle2 className="size-4" /> : <Circle className="size-4 opacity-50" />}
            <span className="font-bold">{viewingEvent.isDone ? "Đã hoàn thành" : "Đánh dấu hoàn thành"}</span>
          </Button>

          <Button
            variant="primary"
            onClick={() => { setDeletingEvent(viewingEvent); setViewingEvent(null); }}
            className="!bg-[var(--danger)] hover:!bg-[var(--danger)] !shadow-none gap-2 shrink-0 border border-transparent"
          >
            <Trash2 className="size-4" /> Xóa sự kiện
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-[var(--accent)]/5 to-transparent rounded-xl border border-[var(--accent)]/20 shadow-sm relative overflow-hidden">
           <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-[var(--accent)]/10 to-transparent pointer-events-none" />
           <div className="flex items-center gap-3">
              <div className={`size-10 rounded-full flex items-center justify-center border-2 border-white shadow-sm ${typeColors[viewingEvent.type] ?? "bg-[var(--fg-muted)]"}`}>
                <CalendarDays className="size-4 text-white" />
              </div>
              <div>
                <h3 className="text-[16px] font-black text-[var(--fg-base)] leading-tight">{viewingEvent.title}</h3>
                <div className="flex items-center gap-2 mt-1">
                   <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${typeColors[viewingEvent.type] ?? "bg-gray-200"} text-white bg-opacity-90`}>
                      {viewingEvent.type === 'reminder' ? 'Nhắc nhở' :
                       viewingEvent.type === 'renewal' ? 'Gia hạn' :
                       viewingEvent.type === 'follow_up' ? 'Chăm sóc' :
                       viewingEvent.type === 'meeting' ? 'Cuộc hẹn' :
                       viewingEvent.type === 'payment' ? 'Thu tiền' : 
                       viewingEvent.type === 'debt' ? 'Công nợ' : viewingEvent.type}
                   </span>
                </div>
              </div>
           </div>
        </div>

        {viewingEvent.customers.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider flex items-center gap-1.5">
              <User className="size-3" /> Khách hàng liên kết ({viewingEvent.customers.length})
            </p>
            <div className="space-y-1.5">
              {viewingEvent.customers.map((c) => (
                <div key={c.id} className="p-2.5 bg-white rounded-xl border border-[var(--border-soft)] shadow-sm flex items-center gap-3">
                  <div className="size-8 rounded-full bg-[var(--accent)]/10 flex items-center justify-center shrink-0">
                    <span className="text-[12px] font-black text-[var(--accent)]">{c.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-[var(--fg-base)] truncate">{c.name}</p>
                    {c.contact && (
                      <p className="text-[11px] text-[var(--fg-muted)] truncate flex items-center gap-1">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent)]/60" />
                        {c.contact}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-[var(--surface-light)] rounded-xl border border-[var(--border-soft)]">
            <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-1 flex items-center gap-1"><CalendarDays className="size-3" /> Ngày</p>
            <p className="text-[14px] font-bold text-[var(--fg-base)]">{viewingEvent.date}</p>
          </div>
          <div className="p-3 bg-[var(--surface-light)] rounded-xl border border-[var(--border-soft)]">
            <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-1 flex items-center gap-1"><Clock className="size-3" /> Giờ</p>
            <p className="text-[14px] font-bold text-[var(--fg-base)]">{viewingEvent.time ?? "Cả ngày"}</p>
          </div>
        </div>
        
        {viewingEvent.notes && (
          <div className="p-3 bg-[var(--surface-light)] rounded-xl border border-[var(--border-soft)] border-l-4 border-l-[var(--accent)]">
            <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <AlignLeft className="size-3.5" /> Ghi chú nội bộ
            </p>
            <div className="text-[13px] text-[var(--fg-base)] leading-relaxed whitespace-pre-wrap pl-1">
              {viewingEvent.notes}
            </div>
          </div>
        )}
        
        {!viewingEvent.hasReminder && (
           <div className="text-center p-2 rounded-lg bg-[var(--bg-app)]/50 border border-[var(--border-soft)] border-dashed">
              <p className="text-[11px] text-[var(--fg-muted)] flex items-center justify-center gap-1.5 font-medium">
                 <Bell className="size-3 opacity-50" /> Không có nhắc nhở hệ thống cho sự kiện này
              </p>
           </div>
        )}
      </div>
    </Modal>
  );
}
