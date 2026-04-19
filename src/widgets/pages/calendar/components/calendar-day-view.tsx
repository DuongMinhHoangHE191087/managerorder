"use client";

import { Bell, CheckCircle2, Circle } from "lucide-react";
import type { CalendarEvent } from "@/lib/domain/types";

const HOURS = Array.from({ length: 24 }, (_, index) => index);
const DAY_NAMES = [
  "Chủ nhật",
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
];

interface CalendarDayViewProps {
  currentDate: Date;
  monthNames: string[];
  getEventsForDate: (date: Date) => CalendarEvent[];
  onViewEvent: (event: CalendarEvent) => void;
  onToggleDone: (event: CalendarEvent) => void;
  typeColors: Record<string, string>;
}

export function CalendarDayView({
  currentDate,
  monthNames,
  getEventsForDate,
  onViewEvent,
  onToggleDone,
  typeColors,
}: CalendarDayViewProps) {
  const dayEvents = getEventsForDate(currentDate);
  const allDayEvents = dayEvents.filter((event) => !event.time);
  const timedEvents = dayEvents.filter((event) => !!event.time);

  return (
    <div className="flex flex-col h-[600px] relative bg-white rounded-b-3xl">
      <div className="px-6 py-4 border-b border-[var(--border-soft)] flex items-center justify-between shrink-0 bg-white/50 backdrop-blur-xl z-20 sticky top-0">
        <div>
          <h4 className="text-[20px] font-black text-[var(--fg-base)]">
            {DAY_NAMES[currentDate.getDay()]}
          </h4>
          <p className="text-[14px] text-[var(--fg-muted)] font-medium">
            {currentDate.getDate()} {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </p>
        </div>
      </div>

      {allDayEvents.length > 0 && (
        <div className="px-14 flex py-2 border-b border-[var(--border-soft)] bg-[var(--surface-light)] shrink-0 z-10 sticky top-[72px]">
          <div className="w-full flex flex-col gap-1.5">
            {allDayEvents.map((event) => (
              <div
                key={event.id}
                onClick={() => onViewEvent(event)}
                className={`px-3 py-1.5 rounded-md text-[11px] font-bold text-white cursor-pointer shadow-sm flex items-center justify-between hover:opacity-80 transition-opacity ${
                  event.isDone
                    ? "bg-[var(--fg-muted)] opacity-60 line-through"
                    : (typeColors[event.type] ?? "bg-[var(--fg-muted)]")
                }`}
              >
                <span className="truncate pr-2">{event.title}</span>
                <div
                  onClick={(clickEvent) => {
                    clickEvent.stopPropagation();
                    onToggleDone(event);
                  }}
                  className="shrink-0 transition-colors hover:text-white/80"
                >
                  {event.isDone ? (
                    <CheckCircle2 className="size-3.5" />
                  ) : (
                    <Circle className="size-3.5" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto relative custom-scrollbar">
        <div className="relative min-w-[500px] h-[1440px]">
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="absolute left-0 right-0 border-t border-[var(--border-soft)]"
              style={{ top: `${hour * 60}px` }}
            >
              <div className="absolute left-2 w-10 text-right pr-2 text-[10px] font-bold text-[var(--fg-muted)] -top-[9px] bg-white">
                {hour === 0 ? "" : `${String(hour).padStart(2, "0")}:00`}
              </div>
            </div>
          ))}

          <div className="absolute top-0 bottom-0 left-14 right-4">
            {timedEvents.map((event) => {
              const [hour, minute] = event.time!.split(":").map(Number);
              const top = (hour + minute / 60) * 60;

              return (
                <div
                  key={event.id}
                  onClick={() => onViewEvent(event)}
                  className={`absolute left-0 right-0 p-2 ml-1 rounded-lg text-white cursor-pointer shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col ${
                    event.isDone
                      ? "opacity-60 bg-[var(--fg-muted)] line-through"
                      : (typeColors[event.type] || "bg-[var(--fg-muted)]")
                  }`}
                  style={{ top: `${top}px`, minHeight: "56px" }}
                >
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <p className="font-bold text-[12px] truncate">{event.title}</p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {event.hasReminder && <Bell className="size-3.5" />}
                      <div
                        onClick={(clickEvent) => {
                          clickEvent.stopPropagation();
                          onToggleDone(event);
                        }}
                        className="transition-colors hover:text-white/80"
                      >
                        {event.isDone ? (
                          <CheckCircle2 className="size-3.5" />
                        ) : (
                          <Circle className="size-3.5" />
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] font-medium opacity-90 mt-0.5">{event.time}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
