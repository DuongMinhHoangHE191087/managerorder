"use client";

import { useRouter } from "next/navigation";
import { ShieldAlert, LogOut, MessageCircle } from "lucide-react";
import { useState } from "react";

export function UnauthorizedClientPage() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const { createSupabaseBrowserClient } = await import("@/lib/supabase/client");
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut({ scope: "global" });
    } finally {
      router.replace("/login");
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--bg-app)] px-4">
      {/* Background blobs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-rose-500/5 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-amber-500/5 blur-3xl" />
        <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose-500/3 blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="glass-card-strong p-8 text-center sm:p-10">
          <div className="mb-6 flex justify-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 shadow-[0_8px_32px_rgba(239,68,68,0.12)]">
              <ShieldAlert className="size-8" />
            </div>
          </div>

          <h1 className="mb-3 text-2xl font-bold tracking-tight text-[var(--fg-base)]">
            Không có quyền truy cập
          </h1>
          <p className="mb-6 text-sm text-[var(--fg-muted)] leading-relaxed">
            Tài khoản Google của bạn chưa được cấp quyền quản trị trên hệ thống này. Vui lòng liên hệ quản trị viên hoặc đăng nhập bằng tài khoản khác.
          </p>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoggingOut ? (
                <div className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <LogOut className="size-4" />
              )}
              Đăng xuất & Quay lại
            </button>
            <a
              href="https://zalo.me/0981087885"
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-surface)] px-4 py-3 text-sm font-bold text-[var(--fg-base)] transition-colors hover:bg-[var(--border-soft)]/20"
            >
              <MessageCircle className="size-4 text-blue-500" />
              Liên hệ hỗ trợ Zalo
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
