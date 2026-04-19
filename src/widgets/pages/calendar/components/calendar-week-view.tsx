"use client";

import { useMemo } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import type { CalendarEvent } from "@/lib/domain/types";

const HOURS = Array.from({ length: 24 }, (_, index) => index);
const WEEKDAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

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
    <div className="flex flex-col h-[600px] relative bg-white rounded-b-3xl">
      <div className="flex border-b border-[var(--border-soft)] bg-white/50 backdrop-blur-xl z-20 sticky top-0 shrink-0">
        <div className="w-14 shrink-0 border-r border-[var(--border-soft)]" />
        <div className="flex-1 grid grid-cols-7">
          {weekDays.map((date, index) => {
            const isToday =
              date.getDate() === todayRef.getDate() &&
              date.getMonth() === todayRef.getMonth() &&
              date.getFullYear() === todayRef.getFullYear();

            return (
              <div
                key={index}
                className={`text-center py-3 border-r border-[var(--border-soft)] last:border-r-0 cursor-pointer hover:bg-[var(--surface-light)] ${
                  isToday ? "bg-[var(--accent)]/5" : ""
                }`}
                onClick={() => onOpenDay(date)}
              >
                <p className="text-[10px] font-black text-[var(--fg-muted)] uppercase tracking-widest">
                  {WEEKDAY_LABELS[date.getDay()]}
                </p>
                <p
                  className={`text-[15px] font-bold mt-0.5 ${
                    isToday ? "text-[var(--accent)]" : "text-[var(--fg-base)]"
                  }`}
                >
                  {date.getDate()}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {hasAnyAllDay && (
        <div className="flex border-b border-[var(--border-soft)] bg-[var(--surface-light)] shrink-0 z-10 sticky top-[72px]">
          <div className="w-14 shrink-0 border-r border-[var(--border-soft)] flex items-center justify-center">
            <span className="text-[9px] font-bold text-[var(--fg-muted)] uppercase tracking-wider text-center px-1">
              Cả ngày
            </span>
          </div>
          <div className="flex-1 grid grid-cols-7">
            {allDayWeekEvents.map((dayEvents, dayIndex) => (
              <div
                key={dayIndex}
                className="border-r border-[var(--border-soft)] last:border-r-0 p-1 flex flex-col gap-1 min-h-[30px]"
              >
                {dayEvents.map((event) => (
                  <div
                    key={event.id}
                    onClick={() => onViewEvent(event)}
                    className={`px-1.5 py-1 rounded text-[9px] font-bold text-white cursor-pointer shadow-sm flex items-center justify-between hover:opacity-80 transition-opacity leading-tight ${
                      event.isDone
                        ? "bg-[var(--fg-muted)] opacity-60 line-through"
                        : (typeColors[event.type] ?? "bg-[var(--fg-muted)]")
                    }`}
                    title={event.title}
                  >
                    <span className="truncate pr-1">{event.title}</span>
                    <div
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation();
                        onToggleDone(event);
                      }}
                      className="shrink-0 transition-colors hover:text-white/80"
                    >
                      {event.isDone ? (
                        <CheckCircle2 className="size-2.5" />
                      ) : (
                        <Circle className="size-2.5" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto relative custom-scrollbar">
        <div className="flex min-w-[700px] h-[1440px]">
          <div className="w-14 shrink-0 border-r border-[var(--border-soft)] relative bg-white z-10">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="absolute left-0 right-0 h-[60px]"
                style={{ top: `${hour * 60}px` }}
              >
                <div className="text-right pr-2 text-[10px] font-bold text-[var(--fg-muted)] relative -top-[8px]">
                  {hour === 0 ? "" : `${String(hour).padStart(2, "0")}:00`}
                </div>
              </div>
            ))}
          </div>
          <div className="flex-1 grid grid-cols-7 relative">
            <div className="absolute inset-0 pointer-events-none">
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="border-t border-[var(--border-soft)] w-full h-[60px]"
                />
              ))}
            </div>

            {timedWeekEvents.map((dayEvents, columnIndex) => (
              <div
                key={columnIndex}
                className="relative border-r border-[var(--border-soft)] last:border-r-0 h-full"
              >
                {dayEvents.map((event) => {
                  const [hour, minute] = event.time!.split(":").map(Number);
                  const top = (hour + minute / 60) * 60;

                  return (
                    <div
                      key={event.id}
                      onClick={() => onViewEvent(event)}
                      className={`absolute left-0.5 right-0.5 p-1.5 rounded-md text-white cursor-pointer shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col ${
                        event.isDone
                          ? "opacity-60 bg-[var(--fg-muted)] line-through"
                          : (typeColors[event.type] || "bg-[var(--fg-muted)]")
                      }`}
                      style={{ top: `${top}px`, minHeight: "56px" }}
                    >
                      <div className="flex items-start justify-between gap-1 min-w-0">
                        <p className="font-bold text-[10px] leading-tight truncate">
                          {event.title}
                        </p>
                        <div
                          onClick={(clickEvent) => {
                            clickEvent.stopPropagation();
                            onToggleDone(event);
                          }}
                          className="shrink-0 transition-colors hover:text-white/80"
                        >
                          {event.isDone ? (
                            <CheckCircle2 className="size-3" />
                          ) : (
                            <Circle className="size-3" />
                          )}
                        </div>
                      </div>
                      <p className="text-[9px] font-medium opacity-90 mt-0.5">{event.time}</p>
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
