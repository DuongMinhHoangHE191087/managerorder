"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { vi } from "@/shared/messages/vi";
import { useFloatingSelectorPosition } from "@/shared/ui/floating-selector";

export interface SmartSelectorItem {
  id: string;
  label: string;
  sublabel?: string;
  createdAt?: string;
}

interface SmartSelectorProps {
  items: SmartSelectorItem[];
  value?: string;
  onSelect: (item: SmartSelectorItem) => void;
  onCreateNew?: () => void;
  placeholder?: string;
  createLabel?: string;
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
  placement?: "auto" | "top" | "bottom";
  offset?: number;
  maxPanelHeight?: number;
}

export function SmartSelector({
  items,
  value,
  onSelect,
  onCreateNew,
  placeholder = vi.common.searchPlaceholder,
  createLabel = vi.common.create,
  disabled,
  isLoading,
  className,
  placement = "auto",
  offset = 8,
  maxPanelHeight = 320,
}: SmartSelectorProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { position, updatePosition } = useFloatingSelectorPosition(triggerRef, isOpen, {
    placement,
    offset,
    maxPanelHeight,
  });

  const selectedItem = useMemo(
    () => items.find((item) => item.id === value),
    [items, value],
  );

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const sorted = [...items].sort((left, right) => {
      if (left.createdAt && right.createdAt) {
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      }
      return 0;
    });

    if (!normalizedQuery) {
      return sorted;
    }

    return sorted.filter((item) =>
      item.label.toLowerCase().includes(normalizedQuery) ||
      item.sublabel?.toLowerCase().includes(normalizedQuery),
    );
  }, [items, query]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
        setQuery("");
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    updatePosition();
    window.setTimeout(() => inputRef.current?.focus(), 30);
  }, [isOpen, updatePosition]);

  const handleSelect = (item: SmartSelectorItem) => {
    onSelect(item);
    setIsOpen(false);
    setQuery("");
  };

  const dropdownContent = isOpen ? (
    <div
      ref={dropdownRef}
      className="overlay-surface rounded-[20px]"
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        width: position.width,
        zIndex: "var(--z-command-palette)",
        maxHeight: position.maxHeight,
        transformOrigin: position.placement === "top" ? "bottom center" : "top center",
      }}
    >
      <div className="border-b border-[var(--border-soft)] p-2.5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--fg-muted)]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
            className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--bg-surface)] py-2.5 pl-9 pr-3 text-[13px] font-medium text-[var(--fg-base)] outline-none placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>
      </div>

      <div
        className="custom-scrollbar overflow-y-auto p-1.5"
        style={{ maxHeight: Math.max(92, position.maxHeight - (onCreateNew ? 92 : 72)) }}
      >
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-[12px] font-medium text-[var(--fg-muted)]">
            {vi.common.noResults}
          </div>
        ) : (
          filtered.map((item) => {
            const selected = item.id === value;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors",
                  selected ? "bg-[var(--accent)]/10" : "hover:bg-[var(--accent)]/6",
                )}
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/10">
                  <span className="text-[11px] font-bold uppercase text-[var(--accent)]">
                    {item.label.charAt(0)}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-[var(--fg-base)]">
                    {item.label}
                  </p>
                  {item.sublabel ? (
                    <p className="truncate text-[11px] text-[var(--fg-muted)]">
                      {item.sublabel}
                    </p>
                  ) : null}
                </div>
                {selected ? <Check className="size-4 shrink-0 text-[var(--accent)]" /> : null}
              </button>
            );
          })
        )}
      </div>

      {onCreateNew ? (
        <div className="border-t border-[var(--border-soft)] p-2">
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setQuery("");
              onCreateNew();
            }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-bold text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/10"
          >
            <div className="flex size-6 items-center justify-center rounded-full bg-[var(--accent)]/15">
              <Plus className="size-3.5" />
            </div>
            {createLabel}
          </button>
        </div>
      ) : null}
    </div>
  ) : null;

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (disabled) {
            return;
          }

          updatePosition();
          setIsOpen(true);
        }}
        disabled={disabled}
        className={cn(
          "flex w-full items-center gap-2 rounded-xl border bg-[var(--bg-surface)] px-3 py-2.5 text-left text-[13px] transition-all outline-none",
          isOpen
            ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/20"
            : "border-[var(--border-soft)] hover:border-[var(--accent)]/40",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        {isLoading ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-[var(--fg-muted)]" />
        ) : (
          <Search className="size-4 shrink-0 text-[var(--fg-muted)]" />
        )}
        <span
          className={cn(
            "flex-1 truncate font-medium",
            selectedItem ? "text-[var(--fg-base)]" : "text-[var(--fg-muted)]",
          )}
        >
          {selectedItem ? selectedItem.label : placeholder}
        </span>
        {selectedItem ? <Check className="size-4 shrink-0 text-[var(--accent)]" /> : null}
      </button>

      {typeof document !== "undefined" && dropdownContent
        ? createPortal(dropdownContent, document.body)
        : null}
    </div>
  );
}
