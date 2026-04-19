"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Input } from "@/shared/ui/input";

interface DuolingoState {
  loading: boolean;
  id?: number;
  username?: string;
  error?: string;
}

/**
 * Gọi proxy API lấy Duolingo ID từ username.
 * Endpoint: /api/proxy/duolingo-id?username=<username>
 * Backend gọi: https://www.duolingo.com/2017-06-30/users?fields=users,id&username=<username>
 */
async function fetchDuolingoId(
  username: string,
  signal?: AbortSignal
): Promise<{ id?: number; username?: string; error?: string }> {
  const input = username.trim();
  if (!input) return { error: "Username rỗng" };

  const res = await fetch(
    `/api/proxy/duolingo-id?username=${encodeURIComponent(input)}`,
    { signal }
  );
  const data = await res.json();
  if (!res.ok) return { error: data.error ?? `HTTP ${res.status}` };
  return data;
}

export function DuolingoNickField({
  value,
  notes,
  onValueChange,
  onNotesChange,
}: {
  value: string;
  notes: string;
  onValueChange: (v: string) => void;
  onNotesChange: (v: string) => void;
}) {
  const [state, setState] = useState<DuolingoState>({ loading: false });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const notesRef = useRef(notes);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  // Ghi Duolingo ID vào notes
  const applyId = useCallback(
    (id: number, username: string) => {
      const line = `Username: ${username} DuolingoID: ${id}`;
      let n = notesRef.current;
      if (/Username: .* DuolingoID: \d+/.test(n) || /Duolingo ID: \d+/.test(n)) {
        n = n
          .replace(/Username: .* DuolingoID: \d+/, line)
          .replace(/Duolingo ID: \d+/, line);
      } else {
        n = n ? `${n}\n${line}` : line;
      }
      onNotesChange(n);
    },
    [onNotesChange]
  );

  // Core fetch logic
  const doFetch = useCallback(
    async (controller: AbortController) => {
      setState({ loading: true });
      try {
        const data = await fetchDuolingoId(value, controller.signal);
        if (controller.signal.aborted) return;
        if (data.error || !data.id) {
          setState({ loading: false, error: data.error ?? "Không tìm thấy" });
          return;
        }
        setState({ loading: false, id: data.id, username: data.username });
        applyId(data.id, data.username ?? value);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (!controller.signal.aborted) {
          setState({ loading: false, error: "Lỗi kết nối" });
        }
      }
    },
    [value, applyId]
  );

  // Auto-fetch debounce 1s
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!value.trim()) {
      Promise.resolve().then(() => setState({ loading: false }));
      return;
    }

    timerRef.current = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      doFetch(controller);
    }, 1000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
  }, [value, doFetch]);

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <Input
            value={value}
            onChange={(e) => {
              onValueChange(e.target.value);
              setState({ loading: false });
            }}
            placeholder="Duolingo username..."
            className="text-[13px] bg-white shadow-sm pr-8"
          />
          {state.loading && (
            <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-green-400 animate-spin" />
          )}
          {state.id && !state.loading && (
            <CheckCircle2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-green-400" />
          )}
        </div>
      </div>
      {state.id && (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/10 border border-green-500/20 rounded-lg text-[11px]">
          <CheckCircle2 className="size-3 text-green-400 shrink-0" />
          <span className="text-green-300 font-mono">
            ID: <strong>{state.id}</strong>
          </span>
          {state.username && (
            <span className="text-slate-500 ml-1">
              • {state.username}
            </span>
          )}
          <span className="text-slate-500 ml-1">• Đã tự động điền</span>
        </div>
      )}
      {state.error && (
        <p className="text-[11px] text-red-400 px-1">{state.error}</p>
      )}
    </div>
  );
}
