"use client";

import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="h-[70vh] w-full flex flex-col items-center justify-center animate-in fade-in duration-500">
      <div className="relative flex items-center justify-center mb-4">
         {/* Outer glowing ring */}
         <div className="absolute inset-0 rounded-full blur-xl bg-[var(--accent)]/20 animate-pulse"></div>
         {/* Spinner */}
         <Loader2 className="size-10 text-[var(--accent)] animate-spin relative z-10" />
      </div>
      <p className="text-[13px] font-bold tracking-widest uppercase text-[var(--fg-muted)] animate-pulse">
        Đang tải dữ liệu...
      </p>
    </div>
  );
}
