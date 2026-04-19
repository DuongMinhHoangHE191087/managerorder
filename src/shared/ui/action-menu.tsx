"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MoreVertical } from "lucide-react";
import { createPortal } from "react-dom";

function useIsMounted() {
  return typeof document !== "undefined";
}

export interface ActionItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "danger";
  dividerBefore?: boolean;
}

interface ActionMenuProps {
  items: ActionItem[];
  className?: string;
}

export function ActionMenu({ items, className = "" }: ActionMenuProps) {
  const mounted = useIsMounted();
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const calculatePosition = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const menuWidth = 220;
    const menuHeight = items.length * 44 + 20;
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    let top = rect.bottom + 8;
    let left = rect.right - menuWidth;

    if (top + menuHeight > viewportHeight - 8) {
      top = rect.top - menuHeight - 8;
    }

    if (left < 8) left = 8;
    if (left + menuWidth > viewportWidth - 8) left = viewportWidth - menuWidth - 8;

    setMenuPos({ top, left });
  }, [items.length]);

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (!open) calculatePosition();
    setOpen((value) => !value);
  }

  useEffect(() => {
    if (!open) return;

    function handleClick(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleScroll() {
      setOpen(false);
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("scroll", handleScroll, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const menu = open ? (
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        top: menuPos.top,
        left: menuPos.left,
        zIndex: 9999,
        minWidth: 220,
      }}
      className="overlay-surface overflow-hidden rounded-[1rem] py-1.5 shadow-[0_22px_44px_rgba(15,23,42,0.18)]"
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`}>
          {item.dividerBefore ? <div className="my-1 border-t border-[var(--border-soft)]" /> : null}
          <button
            type="button"
            onClick={() => {
              item.onClick();
              setOpen(false);
            }}
            className={
              item.variant === "danger"
                ? "flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] font-medium text-[var(--danger)] transition-colors hover:bg-[var(--danger)]/10"
                : "flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] font-medium text-[var(--fg-base)] transition-colors hover:bg-[var(--surface-light)]"
            }
          >
            <span className="flex size-4 shrink-0 items-center justify-center opacity-75">{item.icon}</span>
            {item.label}
          </button>
        </div>
      ))}
    </div>
  ) : null;

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        ref={btnRef}
        onClick={handleToggle}
        className="rounded-[0.9rem] p-1.5 text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-light)] hover:text-[var(--accent)]"
        aria-label="Thao tác"
      >
        <MoreVertical className="size-5" />
      </button>
      {mounted && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
