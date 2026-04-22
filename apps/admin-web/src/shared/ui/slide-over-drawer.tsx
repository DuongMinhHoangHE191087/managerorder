"use client";

import { type ReactNode, useEffect } from "react";
import { X } from "lucide-react";
import { vi } from "@/shared/messages/vi";

interface SlideOverDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: string;
}

export function SlideOverDrawer({
  isOpen,
  onClose,
  title,
  children,
  width = "max-w-md",
}: SlideOverDrawerProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEsc);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex" style={{ zIndex: "var(--z-drawer)" }}>
      <button
        type="button"
        className="fixed inset-0 bg-[rgba(15,23,42,0.34)] backdrop-blur-[2px]"
        onClick={onClose}
        aria-label={vi.common.close}
      />

      <div
        className={`fixed inset-y-0 right-0 flex w-full ${width} flex-col border-l border-[var(--border-soft)] bg-[rgba(255,255,255,0.96)] shadow-[0_28px_70px_rgba(15,23,42,0.16)] backdrop-blur-2xl`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,250,244,0.9))] px-6 py-4">
          <h2 className="text-[16px] font-bold tracking-tight text-[var(--fg-base)]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[0.9rem] p-2 text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-light)] hover:text-[var(--fg-base)]"
            aria-label={vi.common.close}
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
