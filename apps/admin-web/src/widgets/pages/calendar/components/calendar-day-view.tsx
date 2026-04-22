"use client";

import { Bell, CheckCircle2, Circle } from "lucide-react";
import { vi } from "@/shared/messages/vi";
import type { CalendarEvent } from "@/lib/domain/types";

const HOURS = Array.from({ length: 24 }, (_, index) => index);
const DAY_NAMES = vi.calendar.dayNames;

interface CalendarDayViewProps {
  currentDate: Date;
  monthNames: readonly string[];
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
    <div className="relative flex h-[600px] flex-col rounded-b-3xl bg-white">
      <div className="sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-[var(--border-soft)] bg-white/50 px-6 py-4 backdrop-blur-xl">
        <div>
          <h4 className="text-[20px] font-black text-[var(--fg-base)]">
            {DAY_NAMES[currentDate.getDay()]}
          </h4>
          <p className="text-[14px] font-medium text-[var(--fg-muted)]">
            {currentDate.getDate()} {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </p>
        </div>
      </div>

      {allDayEvents.length > 0 && (
        <div className="sticky top-[72px] z-10 flex shrink-0 border-b border-[var(--border-soft)] bg-[var(--surface-light)] px-14 py-2">
          <div className="flex w-full flex-col gap-1.5">
            {allDayEvents.map((event) => (
              <div
                key={event.id}
                onClick={() => onViewEvent(event)}
                className={`flex cursor-pointer items-center justify-between rounded-md px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition-opacity hover:opacity-80 ${
                  event.isDone
                    ? "bg-[var(--fg-muted)] opacity-60 line-through"
                    : typeColors[event.type] ?? "bg-[var(--fg-muted)]"
                }`}
              >
                <span className="truncate pr-2">{event.title}</span>
                <button
                  type="button"
                  onClick={(clickEvent) => {
                    clickEvent.stopPropagation();
                    onToggleDone(event);
                  }}
                  className="shrink-0 transition-colors hover:text-white/80"
                >
                  {event.isDone ? <CheckCircle2 className="size-3.5" /> : <Circle className="size-3.5" />}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="custom-scrollbar relative flex-1 overflow-y-auto">
        <div className="relative min-w-[500px] h-[1440px]">
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="absolute left-0 right-0 border-t border-[var(--border-soft)]"
              style={{ top: `${hour * 60}px` }}
            >
              <div className="absolute -top-[9px] left-2 w-10 bg-white pr-2 text-right text-[10px] font-bold text-[var(--fg-muted)]">
                {hour === 0 ? "" : `${String(hour).padStart(2, "0")}:00`}
              </div>
            </div>
          ))}

          <div className="absolute bottom-0 left-14 right-4 top-0">
            {timedEvents.map((event) => {
              const [hour, minute] = event.time!.split(":").map(Number);
              const top = (hour + minute / 60) * 60;

              return (
                <div
                  key={event.id}
                  onClick={() => onViewEvent(event)}
                  className={`absolute left-0 right-0 ml-1 flex min-h-[56px] flex-col overflow-hidden rounded-lg p-2 text-white shadow-sm transition-shadow hover:shadow-md ${
                    event.isDone
                      ? "bg-[var(--fg-muted)] opacity-60 line-through"
                      : typeColors[event.type] || "bg-[var(--fg-muted)]"
                  }`}
                  style={{ top: `${top}px` }}
                >
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <p className="truncate text-[12px] font-bold">{event.title}</p>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {event.hasReminder && <Bell className="size-3.5" />}
                      <button
                        type="button"
                        onClick={(clickEvent) => {
                          clickEvent.stopPropagation();
                          onToggleDone(event);
                        }}
                        className="transition-colors hover:text-white/80"
                      >
                        {event.isDone ? <CheckCircle2 className="size-3.5" /> : <Circle className="size-3.5" />}
                      </button>
                    </div>
                  </div>
                  <p className="mt-0.5 text-[10px] font-medium opacity-90">{event.time}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
