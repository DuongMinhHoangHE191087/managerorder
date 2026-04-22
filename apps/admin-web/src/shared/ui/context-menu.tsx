"use client";

import { useState, useEffect, ReactNode, useRef } from "react";
import { createPortal } from "react-dom";

interface ContextMenuItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  danger?: boolean;
}

export function useContextMenu() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<ContextMenuItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Prevent hydration mismatch: only render portal after client mount
  useEffect(() => { Promise.resolve().then(() => setMounted(true)); }, []);

  const openContextMenu = (e: React.MouseEvent, newItems: ContextMenuItem[]) => {
    e.preventDefault();
    setItems(newItems);
    setPosition({ x: e.clientX, y: e.clientY });
    setIsOpen(true);
  };

  const closeContextMenu = () => setIsOpen(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeContextMenu();
      }
    };

    const handleScroll = () => closeContextMenu();

    document.addEventListener("click", handleClickOutside);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("click", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [isOpen]);

  const ContextMenuRender = () => {
    if (!mounted || !isOpen) return null;

    // Adjust position if it goes off screen
    const vw = window.innerWidth;
    const style = {
      top: position.y,
      left: position.x,
      transform: position.x > vw - 200 ? "translateX(-100%)" : "none",
    };

    return createPortal(
      <div
        ref={menuRef}
        style={style}
        className="fixed z-[9999] min-w-[200px] rounded-xl border border-[var(--border-soft)] bg-white py-1.5 shadow-[var(--shadow-md)] animate-in fade-in zoom-in-95 duration-100"
      >
        {items.map((item, index) => (
          <button
            key={index}
            onClick={() => {
              item.onClick();
              closeContextMenu();
            }}
            className={`w-full text-left flex items-center gap-2 px-3 py-2 text-[13px] font-medium transition-colors hover:bg-[var(--surface-light)] ${
              item.danger ? "text-[var(--danger)]" : "text-[var(--fg-base)]"
            }`}
          >
            {item.icon && <span className="opacity-70">{item.icon}</span>}
            {item.label}
          </button>
        ))}
      </div>,
      document.body
    );
  };

  return { openContextMenu, ContextMenuRender };
}

