"use client";

import { useMemo } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { vi } from "@/shared/messages/vi";
import type { CalendarEvent } from "@/lib/domain/types";

const HOURS = Array.from({ length: 24 }, (_, index) => index);
const WEEKDAY_LABELS = vi.calendar.weekdayLabels;

interface CalendarWeekViewProps {
  weekDays: Date[];
  todayRef: Date;
  getEventsForDate: (date: Date) => CalendarEvent[];
  onOpenDay: (date: Date) => void;
  onViewEvent: (event: CalendarEvent) => void;
  onToggleDone: (event: CalendarEvent) => void;
  typeColors: Record<string, string>;
}

export function CalendarWeekView({
  weekDays,
  todayRef,
  getEventsForDate,
  onOpenDay,
  onViewEvent,
  onToggleDone,
  typeColors,
}: CalendarWeekViewProps) {
  const weekEvents = useMemo(
    () => weekDays.map((date) => getEventsForDate(date)),
    [getEventsForDate, weekDays],
  );
  const allDayWeekEvents = useMemo(
    () => weekEvents.map((dayEvents) => dayEvents.filter((event) => !event.time)),
    [weekEvents],
  );
  const timedWeekEvents = useMemo(
    () => weekEvents.map((dayEvents) => dayEvents.filter((event) => !!event.time)),
    [weekEvents],
  );
  const hasAnyAllDay = allDayWeekEvents.some((dayEvents) => dayEvents.length > 0);

  return (
    <div className="relative flex h-[600px] flex-col rounded-b-3xl bg-white">
      <div className="sticky top-0 z-20 flex shrink-0 border-b border-[var(--border-soft)] bg-white/50 backdrop-blur-xl">
        <div className="w-14 shrink-0 border-r border-[var(--border-soft)]" />
        <div className="grid flex-1 grid-cols-7">
          {weekDays.map((date, index) => {
            const isToday =
              date.getDate() === todayRef.getDate() &&
              date.getMonth() === todayRef.getMonth() &&
              date.getFullYear() === todayRef.getFullYear();

            return (
              <div
                key={index}
                className={`cursor-pointer border-r border-[var(--border-soft)] py-3 text-center last:border-r-0 hover:bg-[var(--surface-light)] ${
                  isToday ? "bg-[var(--accent)]/5" : ""
                }`}
                onClick={() => onOpenDay(date)}
              >
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--fg-muted)]">
                  {WEEKDAY_LABELS[date.getDay()]}
                </p>
                <p className={`mt-0.5 text-[15px] font-bold ${isToday ? "text-[var(--accent)]" : "text-[var(--fg-base)]"}`}>
                  {date.getDate()}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {hasAnyAllDay && (
        <div className="sticky top-[72px] z-10 flex shrink-0 border-b border-[var(--border-soft)] bg-[var(--surface-light)]">
          <div className="flex w-14 shrink-0 items-center justify-center border-r border-[var(--border-soft)]">
            <span className="px-1 text-center text-[9px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
              {vi.calendar.allDay}
            </span>
          </div>
          <div className="grid flex-1 grid-cols-7">
            {allDayWeekEvents.map((dayEvents, dayIndex) => (
              <div
                key={dayIndex}
                className="flex min-h-[30px] flex-col gap-1 border-r border-[var(--border-soft)] p-1 last:border-r-0"
              >
                {dayEvents.map((event) => (
                  <div
                    key={event.id}
                    onClick={() => onViewEvent(event)}
                    className={`flex cursor-pointer items-center justify-between rounded px-1.5 py-1 text-[9px] font-bold leading-tight text-white shadow-sm transition-opacity hover:opacity-80 ${
                      event.isDone
                        ? "bg-[var(--fg-muted)] opacity-60 line-through"
                        : typeColors[event.type] ?? "bg-[var(--fg-muted)]"
                    }`}
                    title={event.title}
                  >
                    <span className="truncate pr-1">{event.title}</span>
                    <button
                      type="button"
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation();
                        onToggleDone(event);
                      }}
                      className="shrink-0 transition-colors hover:text-white/80"
                    >
                      {event.isDone ? <CheckCircle2 className="size-2.5" /> : <Circle className="size-2.5" />}
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="custom-scrollbar relative flex-1 overflow-y-auto">
        <div className="flex min-w-[700px] h-[1440px]">
          <div className="relative z-10 w-14 shrink-0 border-r border-[var(--border-soft)] bg-white">
            {HOURS.map((hour) => (
              <div key={hour} className="absolute left-0 right-0 h-[60px]" style={{ top: `${hour * 60}px` }}>
                <div className="relative -top-[8px] pr-2 text-right text-[10px] font-bold text-[var(--fg-muted)]">
                  {hour === 0 ? "" : `${String(hour).padStart(2, "0")}:00`}
                </div>
              </div>
            ))}
          </div>
          <div className="relative grid flex-1 grid-cols-7">
            <div className="pointer-events-none absolute inset-0">
              {HOURS.map((hour) => (
                <div key={hour} className="h-[60px] w-full border-t border-[var(--border-soft)]" />
              ))}
            </div>

            {timedWeekEvents.map((dayEvents, columnIndex) => (
              <div
                key={columnIndex}
                className="relative h-full border-r border-[var(--border-soft)] last:border-r-0"
              >
                {dayEvents.map((event) => {
                  const [hour, minute] = event.time!.split(":").map(Number);
                  const top = (hour + minute / 60) * 60;

                  return (
                    <div
                      key={event.id}
                      onClick={() => onViewEvent(event)}
                      className={`absolute left-0.5 right-0.5 flex min-h-[56px] flex-col overflow-hidden rounded-md p-1.5 text-white shadow-sm transition-shadow hover:shadow-md ${
                        event.isDone
                          ? "bg-[var(--fg-muted)] opacity-60 line-through"
                          : typeColors[event.type] || "bg-[var(--fg-muted)]"
                      }`}
                      style={{ top: `${top}px` }}
                    >
                      <div className="flex min-w-0 items-start justify-between gap-1">
                        <p className="truncate text-[10px] font-bold leading-tight">{event.title}</p>
                        <button
                          type="button"
                          onClick={(clickEvent) => {
                            clickEvent.stopPropagation();
                            onToggleDone(event);
                          }}
                          className="shrink-0 transition-colors hover:text-white/80"
                        >
                          {event.isDone ? <CheckCircle2 className="size-3" /> : <Circle className="size-3" />}
                        </button>
                      </div>
                      <p className="mt-0.5 text-[9px] font-medium opacity-90">{event.time}</p>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
