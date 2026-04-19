"use client";

import { useRouter } from "next/navigation";
import { ChevronDown, LogOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/stores/auth-store";

export function NavUserMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const user = useAuthStore((state) => state.user);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email?.split("@")[0] || "Admin"
    : "Admin";
  const initials = displayName.charAt(0).toUpperCase();

  if (!isInitialized) {
    return (
      <div className="flex items-center gap-2 rounded-xl px-2 py-1">
        <div className="size-8 rounded-full bg-[var(--border-soft)] animate-pulse" />
        <div className="hidden h-4 w-24 rounded-full bg-[var(--border-soft)] animate-pulse sm:block" />
      </div>
    );
  }

  return (
    <div ref={menuRef} className="relative">
      <div className="flex items-center gap-2 border-l border-[var(--border-soft)] pl-2 sm:gap-3 sm:pl-3">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-[var(--surface-light)]"
        >
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-[var(--fg-base)]">{displayName}</p>
            <p className="text-[10px] uppercase font-bold text-[var(--accent)] tracking-wider">Quản trị viên</p>
          </div>
          <div className="flex size-9 items-center justify-center overflow-hidden rounded-full border border-[var(--border-soft)] bg-[var(--surface-light)]">
            <span className="text-sm font-bold text-[var(--accent)]">{initials}</span>
          </div>
          <ChevronDown className={cn("hidden size-3 text-[var(--fg-muted)] transition-transform sm:block", open && "rotate-180")} />
        </button>
      </div>

      {open ? (
        <div
          className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-surface)] shadow-[var(--shadow-md)]"
          style={{ zIndex: "var(--z-dropdown)" }}
        >
          <div className="border-b border-[var(--border-soft)] px-4 py-3">
            <p className="truncate text-sm font-semibold text-[var(--fg-base)]">{displayName}</p>
            <p className="truncate text-xs text-[var(--fg-muted)]">{user?.email}</p>
          </div>
          <div className="p-1.5">
            <button
              type="button"
              onClick={async () => {
                setOpen(false);
                await logout();
                router.replace("/login");
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--danger)] transition-colors hover:bg-[var(--danger)]/10"
            >
              <LogOut className="size-4" />
              Đăng xuất
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
