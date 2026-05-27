"use client";

import { useState, useEffect, useMemo } from "react";
import { useDebounce } from "@/shared/hooks/use-debounce";
import {
  Plus, Clock,
  ChevronLeft, ChevronRight, RefreshCw, AlertTriangle,
  CheckCircle2, Circle
} from "lucide-react";
import { appToast } from "@/shared/lib/toast";
import { vi } from "@/shared/messages/vi";

import { AppLayout } from "@/widgets/layout/app-layout";
import { PageContainer } from "@/shared/ui/page-layout";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
const EventCreateModal = dynamic(() => import("@/widgets/pages/calendar/components/event-create-modal").then(mod => mod.EventCreateModal), {
  ssr: false,
});
const EventViewModal = dynamic(() => import("@/widgets/pages/calendar/components/event-view-modal").then(mod => ({ default: mod.EventViewModal })), {
  ssr: false,
});
const EventDeleteModal = dynamic(() => import("@/widgets/pages/calendar/components/event-delete-modal").then(mod => ({ default: mod.EventDeleteModal })), {
  ssr: false,
});
const RenewalPanel = dynamic(() => import("@/widgets/pages/calendar/components/renewal-panel").then(mod => ({ default: mod.RenewalPanel })), {
  ssr: false,
});
const CalendarWeekView = dynamic(() => import("@/widgets/pages/calendar/components/calendar-week-view").then(mod => ({ default: mod.CalendarWeekView })), {
  ssr: false,
  loading: () => <CalendarSubviewSkeleton />,
});
const CalendarDayView = dynamic(() => import("@/widgets/pages/calendar/components/calendar-day-view").then(mod => ({ default: mod.CalendarDayView })), {
  ssr: false,
  loading: () => <CalendarSubviewSkeleton />,
});
import type { CalendarEvent } from "@/lib/domain/types";
import { useCalendarEvents, useDeleteCalendarEvent, useUpdateCalendarEvent, useCreateCalendarEvent } from "@/widgets/pages/calendar/hooks/use-calendar-events";
import { useCalendarNotes } from "@/widgets/pages/calendar/hooks/use-calendar-notes";
import { useRenewals } from "@/widgets/pages/calendar/hooks/use-renewals";
import { GoogleConnectButton } from "@/widgets/pages/calendar/components/GoogleConnectButton";
import { formatDateKey } from "@/lib/utils";

const calendarText = vi.calendar.page;
const calendarMonths = vi.calendar.monthNames;
type CalendarViewMode = "month" | "week" | "day";

type QueryReader = {
  get: (name: string) => string | null;
};

type CalendarRouteState = {
  currentMonth: Date;
  calendarView: CalendarViewMode;
};

const CALENDAR_VIEW_VALUES = new Set<CalendarViewMode>(["month", "week", "day"]);

function readEnumParam<T extends string>(params: QueryReader, key: string, values: Set<T>, fallback: T) {
  const value = params.get(key);
  return value && values.has(value as T) ? (value as T) : fallback;
}

function readCalendarDate(value: string | null) {
  if (!value) return new Date();
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function readCalendarRouteState(params: QueryReader): CalendarRouteState {
  return {
    currentMonth: readCalendarDate(params.get("date")),
    calendarView: readEnumParam(params, "view", CALENDAR_VIEW_VALUES, "month"),
  };
}

function writeCalendarRouteState(params: URLSearchParams, state: CalendarRouteState) {
  const todayKey = formatDateKey(new Date());
  const currentDateKey = formatDateKey(state.currentMonth);

  if (state.calendarView !== "month") {
    params.set("view", state.calendarView);
  } else {
    params.delete("view");
  }

  if (currentDateKey !== todayKey) {
    params.set("date", currentDateKey);
  } else {
    params.delete("date");
  }
}

function buildCalendarHref(params: URLSearchParams) {
  const queryString = params.toString();
  return queryString ? `/calendar?${queryString}` : "/calendar";
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function CalendarSubviewSkeleton() {
  return (
    <div className="h-[600px] rounded-b-3xl border-t border-[var(--border-soft)] bg-white p-6 space-y-4">
      <div className="h-8 w-56 rounded bg-gray-200 animate-pulse" />
      <div className="grid grid-cols-1 gap-3">
        {[...Array(6)].map((_, index) => (
          <div key={index} className="h-16 rounded-xl bg-gray-200 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRouteState = readCalendarRouteState(searchParams);
  const { data: events = [] } = useCalendarEvents();
  const { mutateAsync: deleteEvent } = useDeleteCalendarEvent();
  const { mutateAsync: updateEvent } = useUpdateCalendarEvent();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createInitialDate, setCreateInitialDate] = useState("");
  const [viewingEvent, setViewingEvent] = useState<CalendarEvent | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<CalendarEvent | null>(null);
  const [currentMonth, setCurrentMonth] = useState(initialRouteState.currentMonth);
  const [calendarView, setCalendarView] = useState<CalendarViewMode>(initialRouteState.calendarView);

  const { noteQuery, saveNoteMutation } = useCalendarNotes();
  const { data: savedNoteText = "" } = noteQuery;

  // Quick Add State
  const { mutateAsync: createEvent } = useCreateCalendarEvent();
  const [quickAddText, setQuickAddText] = useState("");
  const [isQuickAdding, setIsQuickAdding] = useState(false);

  const handleQuickAdd = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && quickAddText.trim()) {
      setIsQuickAdding(true);
      try {
        await createEvent({
          title: quickAddText.trim(),
          type: "reminder", 
          date: formatDateKey(new Date()),
        });
        appToast.success(calendarText.quickAddSuccess);
        setQuickAddText("");
      } catch (_error) {
        appToast.error(calendarText.quickAddError);
      } finally {
        setIsQuickAdding(false);
      }
    }
  };

  // Sync saved note on first load
  useEffect(() => {
    if (savedNoteText) {
      setNoteText(savedNoteText);
    }
  }, [savedNoteText]);

  // Notes State
  const [noteText, setNoteText] = useState("");
  const debouncedNoteText = useDebounce(noteText, 1000);

  // Auto-save logic
  useEffect(() => {
    // Only save if text changed compared to what's in DB to prevent infinite loops
    if (debouncedNoteText !== undefined && debouncedNoteText !== savedNoteText) {
      saveNoteMutation.mutate(debouncedNoteText);
    }
  }, [debouncedNoteText, savedNoteText, saveNoteMutation]);

  useEffect(() => {
    const nextState = readCalendarRouteState(searchParams);
    setCurrentMonth(nextState.currentMonth);
    setCalendarView(nextState.calendarView);
  }, [searchParams]);

  useEffect(() => {
    const currentQuery = searchParams.toString();
    const params = new URLSearchParams(currentQuery);
    writeCalendarRouteState(params, { currentMonth, calendarView });

    if (params.toString() !== currentQuery) {
      router.replace(buildCalendarHref(params), { scroll: false });
    }
  }, [calendarView, currentMonth, router, searchParams]);

  function openCreateForDate(date: string) {
    setCreateInitialDate(date);
    setIsCreateOpen(true);
  }

  function openDayView(date: Date) {
    setCurrentMonth(date);
    setCalendarView("day");
  }

  // --- CRM Renewal Panel (React Query) ---
  const { renewals: renewalItems, isLoading: renewalLoading, error: renewalError, refetch: refetchRenewals, requestRenewal, markAsPaid } = useRenewals();

  function handleManualRenewCancel(subscriptionId: string) {
    appToast.info(calendarText.manualRenewCancel(subscriptionId));
  }

  async function handleDelete() {
    if (!deletingEvent) return;
    try {
      await deleteEvent(deletingEvent.id);
      setDeletingEvent(null);
      setViewingEvent(null);
      appToast.success(calendarText.deleteSuccess);
    } catch {
      appToast.error(calendarText.deleteError);
    }
  }

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  const todayRef = new Date();
  const todayDateStr = formatDateKey(todayRef); // Local timezone, ISO format (yyyy-MM-dd)
  
  const todayTodoList = useMemo(() => {
    return events.filter((event): event is CalendarEvent => Boolean(event?.date)).filter(e => e.date === todayDateStr).sort((a,b) => {
      if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
      return (a.time||"").localeCompare(b.time||"");
    });
  }, [events, todayDateStr]);

  const debtEvents = useMemo(() => {
    const t = new Date(todayDateStr + 'T00:00:00');
    return events.filter((event): event is CalendarEvent => Boolean(event?.date)).filter(e => {
      if (e.date >= todayDateStr) return false;
      const eventDate = new Date(e.date + 'T00:00:00');
      const diffDays = Math.floor((t.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24));
      // Chỉ lấy event quá hạn, không quá 7 ngày. Ẩn event đã hoàn thành khỏi nợ kế hoạch.
      if (diffDays <= 0 || diffDays > 7) return false;
      if (e.isDone) return false;
      return true;
    }).sort((a,b) => {
      // Công việc đã xong tự động chìm xuống cuối list
      if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
      return (""+b.date).localeCompare(""+a.date);
    });
  }, [events, todayDateStr]);

  async function toggleEventDone(event: CalendarEvent) {
    try {
      await updateEvent({ id: event.id, is_done: !event.isDone });
      if (!event.isDone) {
        appToast.success(calendarText.doneSuccess(event.title));
      }
    } catch {
      appToast.error(calendarText.doneError);
    }
  }

  const calendarDays = useMemo(() => Array.from({ length: 42 }, (_, i) => {
    const dayNum = i - firstDay + 1;
    if (dayNum < 1 || dayNum > daysInMonth) return null;
    return dayNum;
  }), [firstDay, daysInMonth]);

  // Week calculation
  const weekDays = useMemo(() => {
    const sow = new Date(currentMonth);
    sow.setDate(currentMonth.getDate() - currentMonth.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sow);
      d.setDate(sow.getDate() + i);
      return d;
    });
  }, [currentMonth]);

  // PERF-12: Pre-group events by date for O(1) lookup instead of O(n) per cell
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      if (!e?.date) {
        continue;
      }
      const existing = map.get(e.date);
      if (existing) existing.push(e);
      else map.set(e.date, [e]);
    }
    return map;
  }, [events]);

  function getEventsForDate(d: Date) {
    const dateStr = formatDateKey(d);
    return eventsByDate.get(dateStr) ?? [];
  }

  function getEventsForDay(day: number) {
    if (!day) return [];
    return getEventsForDate(new Date(year, month, day));
  }

  function hasRenewalOnDate(d: Date): boolean {
    const dateStr = formatDateKey(d);
    return renewalDateSet.has(dateStr);
  }

  function prevPeriod() {
    if (calendarView === "month") setCurrentMonth(new Date(year, month - 1, 1));
    else if (calendarView === "week") setCurrentMonth(new Date(year, month, currentMonth.getDate() - 7));
    else setCurrentMonth(new Date(year, month, currentMonth.getDate() - 1));
  }
  
  function nextPeriod() {
    if (calendarView === "month") setCurrentMonth(new Date(year, month + 1, 1));
    else if (calendarView === "week") setCurrentMonth(new Date(year, month, currentMonth.getDate() + 7));
    else setCurrentMonth(new Date(year, month, currentMonth.getDate() + 1));
  }

  // Mark dates that have expiring subscriptions on the calendar
  const renewalDateSet = useMemo(() => {
    const set = new Set<string>();
    renewalItems.forEach(r => {
      if (r.expiry_date) set.add(r.expiry_date.slice(0, 10));
    });
    return set;
  }, [renewalItems]);

  function hasRenewalOnDay(day: number): boolean {
    return hasRenewalOnDate(new Date(year, month, day));
  }

  const typeColors: Record<string, string> = {
    renewal: "bg-[var(--accent)]",
    followup: "bg-[#ff9500]",
    reminder: "bg-[#5ac8fa]",
    payment: "bg-[#ff3b30]",
  };

  const monthNames = calendarMonths;

  // Urgency stats (computed for header row)
  const stats = useMemo(() => ({
    expired: renewalItems.filter(i => i.days_remaining <= 0).length,
    urgent: renewalItems.filter(i => i.days_remaining > 0 && i.days_remaining <= 3).length,
    soon: renewalItems.filter(i => i.days_remaining > 3 && i.days_remaining <= 7).length,
    total: renewalItems.length,
  }), [renewalItems]);

  return (
    <AppLayout>
      <PageContainer className="relative">
        {/* ===== HEADER ===== */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-[var(--fg-base)]">{calendarText.title}</h1>
            <p className="text-[15px] text-[var(--fg-muted)] mt-1">{calendarText.description}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => refetchRenewals()}
              aria-label={calendarText.refreshRenewals}
              className="p-2.5 rounded-full border border-[var(--border-soft)] hover:bg-[var(--surface-light)] transition-colors cursor-pointer"
            >
              <RefreshCw aria-hidden="true" className={`size-4 text-[var(--fg-muted)] ${renewalLoading ? "animate-spin" : ""}`} />
            </button>
            <GoogleConnectButton />
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="bg-gradient-to-r from-[var(--accent)] to-[var(--accent-strong)] text-white px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 shadow-sm hover:shadow-md transition-[box-shadow] cursor-pointer"
            >
              <Plus aria-hidden="true" className="size-4" />
               {calendarText.addEvent}
            </button>
          </div>
        </div>

        <div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: calendarText.stats.renewalsSoon, value: stats.total, color: "text-[var(--accent)]", bg: "bg-[var(--accent)]/8" },
                { label: calendarText.stats.expired, value: stats.expired, color: "text-[var(--danger)]", bg: "bg-[var(--danger)]/8" },
                { label: calendarText.stats.urgent3, value: stats.urgent, color: "text-[#ff3b30]", bg: "bg-[#ff3b30]/8" },
                { label: calendarText.stats.urgent7, value: stats.soon, color: "text-[#ff9500]", bg: "bg-[#ff9500]/8" },
              ].map(s => (
              <div key={s.label} className={`${s.bg} rounded-xl p-4 border border-[var(--border-soft)]`}>
                <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-[11px] text-[var(--fg-muted)] font-medium mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ===== MAIN 2-COLUMN GRID ===== */}
        <div className="grid grid-cols-1 xl:grid-cols-[7fr_3fr] gap-6 items-start">

          {/* ─── LEFT: Calendar Grid ─── */}
          <div className="min-w-0" data-testid="calendar-grid">
            <div className="glass-card rounded-xl overflow-hidden border border-[var(--border-soft)] bg-white">
              {/* Nav */}
              <div className="flex flex-col sm:flex-row items-center justify-between px-5 py-4 border-b border-[var(--border-soft)] bg-[var(--bg-app)]/50 backdrop-blur-sm gap-4">
                <div className="flex items-center gap-3">
                    <button
                     type="button"
                     onClick={prevPeriod}
                     aria-label={calendarText.prev}
                     data-testid="prev-month"
                    className="p-2 hover:bg-[var(--surface-light)] rounded-lg transition-colors cursor-pointer"
                  >
                    <ChevronLeft aria-hidden="true" className="size-4 text-[var(--fg-muted)]" />
                  </button>
                  <h3 data-testid="month-label" className="text-[15px] font-black text-[var(--fg-base)] tracking-tight w-40 text-center">
                    {calendarView === "month" && `${monthNames[month]} ${year}`}
                    {calendarView === "week" && `T${weekDays[0].getMonth()+1} - T${weekDays[6].getMonth()+1} ${year}`}
                    {calendarView === "day" && `${currentMonth.getDate()} ${monthNames[month]}, ${year}`}
                  </h3>
                    <button
                     type="button"
                     onClick={nextPeriod}
                     aria-label={calendarText.next}
                     data-testid="next-month"
                    className="p-2 hover:bg-[var(--surface-light)] rounded-lg transition-colors cursor-pointer"
                  >
                    <ChevronRight aria-hidden="true" className="size-4 text-[var(--fg-muted)]" />
                  </button>
                </div>
                {/* View Toggles */}
                <div className="flex bg-[var(--surface-light)] p-1 rounded-lg border border-[var(--border-soft)]">
                  {(["month", "week", "day"] as const).map(view => (
                    <button
                      type="button"
                      key={view}
                      onClick={() => setCalendarView(view)}
                      aria-pressed={calendarView === view}
                      className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-md transition-[background-color,box-shadow,color] cursor-pointer ${
                        calendarView === view 
                          ? "bg-[var(--accent)] text-white shadow-sm" 
                          : "text-[var(--fg-muted)] hover:text-[var(--fg-base)] hover:bg-[var(--bg-app)]/50"
                      }`}
                    >
                      {view === "month" ? calendarText.view.month : view === "week" ? calendarText.view.week : calendarText.view.day}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid or List depending on view */}
              {calendarView === "month" && (
                <>
                  {/* Day labels */}
               <div className="grid grid-cols-7 border-b border-[var(--border-soft)]">
                 {calendarText.dayLabels.map((d) => (
                  <div key={d} className="text-center py-2.5 text-[10px] font-black text-[var(--fg-muted)] uppercase tracking-widest">
                    {d}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7">
                {calendarDays.map((day, i) => {
                  const dayEvents = day ? getEventsForDay(day) : [];
                  const hasRenewal = day ? hasRenewalOnDay(day) : false;
                  const isToday =
                    day === todayRef.getDate() &&
                    month === todayRef.getMonth() &&
                    year === todayRef.getFullYear();

                  return (
                    <div
                      key={i}
                      onClick={() => { if(day) { openCreateForDate(`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`); } }}
                      className={`min-h-[100px] p-2 border-b border-[var(--border-soft)] relative ${
                        i % 7 !== 6 ? "border-r" : ""
                      } ${
                        day ? "hover:bg-[var(--surface-light)]/40 cursor-pointer" : "bg-[var(--bg-surface)]/20"
                      } transition-colors flex flex-col`}
                    >
                      {day && (
                        <>
                          <div className="flex items-center justify-between mb-1.5">
                            <span
                              className={`text-[12px] font-bold inline-flex items-center justify-center size-6 rounded-full ${
                                isToday ? "bg-[var(--accent)] text-white" : "text-[var(--fg-base)]"
                              }`}
                            >
                              {day}
                            </span>
                            {/* Renewal dot indicator */}
                            {hasRenewal && (
                              <span
                                className="size-2 rounded-full bg-[#ff9500] shrink-0"
                                 title={calendarText.renewalDot}
                              />
                            )}
                          </div>
                          <div className="space-y-1 flex-1 overflow-y-auto pr-0.5 custom-scrollbar">
                            {dayEvents.map(evt => (
                              <button
                                type="button"
                                key={evt.id}
                                onClick={(e) => { e.stopPropagation(); setViewingEvent(evt); }}
                                className={`w-full text-left px-1.5 py-1 rounded text-[10px] font-bold text-white truncate flex items-center gap-1 ${
                                  evt.isDone ? "bg-[var(--fg-muted)] opacity-60 line-through" : (typeColors[evt.type] ?? "bg-[var(--fg-muted)]")
                                } hover:opacity-80 transition-opacity cursor-pointer`}
                              >
                                <span onClick={(e) => { e.stopPropagation(); toggleEventDone(evt); }} className="shrink-0 transition-colors hover:text-white/80">
                                  {evt.isDone ? <CheckCircle2 className="size-2.5" /> : <Circle className="size-2.5" />}
                                </span>
                                <span className="truncate">{evt.title}</span>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
              </>
              )}

              {calendarView === "week" && (
                <CalendarWeekView
                  weekDays={weekDays}
                  todayRef={todayRef}
                  getEventsForDate={getEventsForDate}
                  onOpenDay={openDayView}
                  onViewEvent={setViewingEvent}
                  onToggleDone={toggleEventDone}
                  typeColors={typeColors}
                />
              )}

              {calendarView === "day" && (
                <CalendarDayView
                  currentDate={currentMonth}
                  monthNames={monthNames}
                  getEventsForDate={getEventsForDate}
                  onViewEvent={setViewingEvent}
                  onToggleDone={toggleEventDone}
                  typeColors={typeColors}
                />
              )}

              {/* Legend */}
              <div className="flex items-center gap-4 px-4 py-2.5 border-t border-[var(--border-soft)] bg-[var(--bg-app)]/30">
                {[
                  { color: "bg-[var(--accent)]", label: calendarText.legend.renewal },
                  { color: "bg-[#ff9500]", label: calendarText.legend.followup },
                  { color: "bg-[#5ac8fa]", label: calendarText.legend.reminder },
                  { color: "bg-[#ff3b30]", label: calendarText.legend.payment },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-1.5">
                    <span className={`size-2 rounded-full ${l.color}`} />
                    <span className="text-[10px] text-[var(--fg-muted)] font-medium">{l.label}</span>
                  </div>
                ))}
                <div className="flex items-center gap-1.5 ml-auto">
                  <span className="size-1.5 rounded-full bg-[#ff9500]" />
                  <span className="text-[10px] text-[var(--fg-muted)] font-medium">{calendarText.legend.renewalHint}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ─── RIGHT SIDEBAR: Tasks & Renewals ─── */}
          <div className="flex flex-col gap-5 min-w-0 h-full">
            
            {/* --- Quá hạn kế hoạch (Overdue) --- */}
            {debtEvents.length > 0 && (
              <div className="glass-card rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/5 overflow-hidden flex flex-col shrink-0">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--danger)]/10 bg-[var(--danger)]/10">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="size-4 text-[var(--danger)]" />
                    <h3 className="text-[13px] font-black text-[var(--danger)] tracking-tight">{calendarText.overdueTitle}</h3>
                  </div>
                  <span className="text-[10px] font-bold bg-[var(--danger)] text-white px-2 py-0.5 rounded-full shadow-sm">{debtEvents.length}</span>
                </div>
                <div className="p-2 space-y-1 max-h-[200px] overflow-y-auto custom-scrollbar">
                  {debtEvents.filter(e => !e.isDone).length === 0 && debtEvents.length > 0 && (
                    <div className="flex flex-col items-center justify-center py-6 text-center gap-2">
                      <div className="size-10 rounded-full bg-green-500/10 flex items-center justify-center shadow-sm">
                        <CheckCircle2 className="size-5 text-green-500" />
                      </div>
                       <p className="text-[12px] font-bold text-green-600">{calendarText.overdueResolved}</p>
                       <p className="text-[11px] font-medium text-[var(--fg-muted)]">{calendarText.overdueResolvedSub}</p>
                    </div>
                  )}
                  {debtEvents.map(evt => (
                    <div key={evt.id} className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-white/50 transition-colors group">
                       <button type="button" onClick={(e) => { e.stopPropagation(); toggleEventDone(evt); }} className={`mt-0.5 shrink-0 transition-colors cursor-pointer ${evt.isDone ? "text-[var(--danger)]/50" : "text-[var(--danger)]/80 hover:text-[var(--danger)]"}`} aria-label={calendarText.markDone}>
                        {evt.isDone ? <CheckCircle2 className="size-4" /> : <Circle className="size-4" />}
                      </button>
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setViewingEvent(evt)}>
                        <p className={`text-[13px] font-bold truncate transition-[color,opacity,text-decoration-color] ${evt.isDone ? "text-[var(--danger)]/50 line-through" : "text-[var(--danger)]"}`}>{evt.title}</p>
                        <div className={`flex items-center gap-2 mt-0.5 transition-[opacity] ${evt.isDone ? "opacity-50" : "opacity-80"}`}>
                          <span className={`text-[10px] font-medium ${evt.isDone ? "text-[var(--danger)]/60" : "text-[var(--danger)]"}`}>{evt.date}</span>
                          {evt.time && <span className={`text-[10px] flex items-center gap-1 ${evt.isDone ? "text-[var(--danger)]/60" : "text-[var(--danger)]"}`}><Clock className="size-2.5"/>{evt.time}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* --- Ghi chú nhanh (Quick Notes) --- */}
            <div className="relative group rounded-xl overflow-hidden shrink-0 min-h-[160px] shadow-sm">
              {/* Animated gradient background for premium feel */}
              <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)]/10 via-transparent to-purple-500/10 opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="absolute inset-0 backdrop-blur-3xl bg-white/40" />
              <div className="absolute inset-0 border border-white/50 rounded-xl" />
              
              <div className="relative flex flex-col h-full z-10">
                <div className="flex items-center justify-between px-4 py-3 border-b border-black/5">
                     <h3 className="text-[13px] font-black text-[var(--fg-base)] flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent)]"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>
                     {calendarText.notesTitle}
                  </h3>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/5 shadow-inner">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                     <span className="text-[9px] font-bold text-[var(--fg-muted)] uppercase tracking-wider">{calendarText.notesAutoSave}</span>
                  </div>
                </div>
                <textarea 
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                   placeholder={calendarText.notesPlaceholder}
                  className="w-full flex-1 p-4 resize-none bg-transparent outline-none text-[13px] font-medium text-[var(--fg-base)] placeholder:text-[var(--fg-muted)] custom-scrollbar min-h-[110px] decoration-transparent transition-[background-color] focus:bg-white/10"
                  spellCheck={false}
                />
              </div>
            </div>

            {/* --- Hôm Nay Cần Làm (Today's Tasks) --- */}
            <div className="glass-card rounded-xl border border-[var(--border-soft)] bg-white overflow-hidden flex flex-col shrink-0 max-h-[350px]">
              {(() => {
                const doneCount = todayTodoList.filter(e => e.isDone).length;
                const totalCount = todayTodoList.length;
                const percent = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);
                const strokeDasharray = 2 * Math.PI * 14; 
                const strokeDashoffset = strokeDasharray - (percent / 100) * strokeDasharray;

                return (
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-soft)] bg-[var(--bg-app)]/50 backdrop-blur-sm z-10 relative">
                    <div className="flex items-center gap-3">
                      {totalCount > 0 ? (
                        <div className="relative size-8 flex items-center justify-center shrink-0">
                          <svg className="size-full -rotate-90" viewBox="0 0 32 32">
                            <circle cx="16" cy="16" r="14" fill="none" className="stroke-slate-200" strokeWidth="3" />
                            <circle 
                              cx="16" cy="16" r="14" fill="none" 
                              className="stroke-[var(--accent)] transition-[stroke-dashoffset] duration-1000 ease-out"
                              strokeWidth="3" 
                              strokeDasharray={strokeDasharray} 
                              strokeDashoffset={strokeDashoffset} 
                              strokeLinecap="round" 
                            />
                          </svg>
                          <span className="absolute text-[9px] font-bold text-[var(--fg-base)]">{percent}%</span>
                        </div>
                      ) : (
                        <CheckCircle2 className="size-5 text-[var(--accent)]" />
                      )}
                      <div>
                        <h3 className="text-[13px] font-black text-[var(--fg-base)]">{calendarText.todayTitle}</h3>
                        {totalCount > 0 && <p className="text-[10px] font-medium text-[var(--fg-muted)]">{calendarText.todayDone(doneCount, totalCount)}</p>}
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="p-2 border-b border-[var(--border-soft)] bg-[var(--surface-light)]/50 shrink-0 relative z-10">
                <div className="relative">
                  <Plus aria-hidden="true" className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-[var(--fg-muted)]" />
                  <input
                    aria-label="Thêm nhanh việc hôm nay"
                    name="calendar-quick-add"
                    type="text"
                    value={quickAddText}
                    onChange={(e) => setQuickAddText(e.target.value)}
                    onKeyDown={handleQuickAdd}
                    disabled={isQuickAdding}
                    placeholder={calendarText.quickAddPlaceholder}
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-[var(--border-soft)] rounded-lg text-[12px] font-medium outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-[background-color,border-color,box-shadow,color,opacity] placeholder:text-[var(--fg-muted)] disabled:opacity-50 shadow-sm"
                  />
                  {isQuickAdding && <RefreshCw className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-[var(--accent)] animate-spin" />}
                </div>
              </div>

              <div className="p-2 space-y-1 overflow-y-auto custom-scrollbar flex-1 relative min-h-[120px]">
                {todayTodoList.length === 0 ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                    <div className="size-10 mb-2 rounded-full bg-[var(--surface-light)] flex items-center justify-center shadow-sm">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--fg-muted)] opacity-50"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>
                    </div>
                     <p className="text-[12px] font-bold text-[var(--fg-muted)] text-center">{calendarText.emptyToday}<br/><span className="font-medium">{calendarText.emptyTodaySub}</span></p>
                  </div>
                ) : (
                  todayTodoList.map(evt => (
                    <div key={evt.id} className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-white hover:shadow-sm hover:translate-x-1 transition-[background-color,border-color,box-shadow,transform] duration-300 group border border-transparent hover:border-[var(--border-soft)]">
                      <button type="button" onClick={(e) => { e.stopPropagation(); toggleEventDone(evt); }} className={`mt-0.5 shrink-0 transition-colors cursor-pointer ${evt.isDone ? "text-[var(--accent)]" : "text-[var(--fg-muted)] hover:text-[var(--accent)]"}`} aria-label={calendarText.markDone}>
                        {evt.isDone ? <CheckCircle2 className="size-4 shadow-sm rounded-full bg-white" /> : <Circle className="size-4" />}
                      </button>
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setViewingEvent(evt)}>
                        <p className={`text-[13px] font-bold ${evt.isDone ? "text-[var(--fg-muted)] opacity-60 line-through" : "text-[var(--fg-base)]"} truncate transition-[color,opacity,text-decoration-color]`}>{evt.title}</p>
                        {evt.time && <p className="text-[10px] text-[var(--fg-muted)] mt-0.5 flex items-center gap-1"><Clock className="size-2.5"/> {evt.time}</p>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* --- Sắp Gia Hạn (Renewals) --- */}
            <RenewalPanel
              renewals={renewalItems}
              isLoading={renewalLoading}
              error={renewalError}
              onRefetch={() => refetchRenewals()}
              onRequestRenewal={requestRenewal}
              onMarkAsPaid={markAsPaid}
              onManualCancel={handleManualRenewCancel}
            />
          </div>
        </div>
      </PageContainer>

      {/* ===== CREATE EVENT MODAL – shared component ===== */}
      {isCreateOpen && (
        <EventCreateModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onSuccess={() => {}}
          initialDate={createInitialDate}
        />
      )}

      {/* ===== VIEW EVENT MODAL ===== */}
      {viewingEvent && (
        <EventViewModal
          viewingEvent={viewingEvent}
          setViewingEvent={setViewingEvent}
          setDeletingEvent={setDeletingEvent}
          toggleEventDone={toggleEventDone}
          typeColors={typeColors}
        />
      )}

      {/* ===== DELETE CONFIRM ===== */}
      {deletingEvent && (
        <EventDeleteModal
          deletingEvent={deletingEvent}
          setDeletingEvent={setDeletingEvent}
          handleDelete={handleDelete}
        />
      )}
    </AppLayout>
  );
}
