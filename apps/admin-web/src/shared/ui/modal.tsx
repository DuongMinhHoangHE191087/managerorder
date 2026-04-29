"use client";

import { X } from "lucide-react";
import { type ReactNode, useEffect, useId } from "react";
import { cn } from "@/lib/utils";
import { vi } from "@/shared/messages/vi";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl";
}

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
};

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: ModalProps) {
  const titleId = useId();

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

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 overflow-y-auto overscroll-contain" style={{ zIndex: "var(--z-modal)" }}>
      <button
        type="button"
        className="fixed inset-0 bg-[rgba(15,23,42,0.38)] backdrop-blur-[2px] touch-manipulation"
        onClick={onClose}
        aria-label={vi.common.close}
      />

      <div className="flex min-h-full p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4 md:p-6">
        <div
          className={cn(
            "relative m-auto flex max-h-[calc(100dvh-1.5rem)] w-full flex-col overflow-hidden rounded-[30px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.96)] shadow-[0_26px_70px_rgba(15,23,42,0.14)] md:max-h-[90vh]",
            sizeClasses[size],
          )}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,244,0.88))] px-4 py-4 sm:px-6">
            <h2 id={titleId} className="text-[16px] font-bold tracking-tight text-[var(--fg-base)] text-pretty">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-[0.9rem] p-2 text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-light)] hover:text-[var(--fg-base)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              aria-label={vi.common.close}
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
            {children}
          </div>

          {footer ? (
            <div className="border-t border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,250,244,0.88))] px-4 py-4 sm:px-6">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
