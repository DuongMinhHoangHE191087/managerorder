"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { vi } from "@/shared/messages/vi";
import type { SmartSelectorItem } from "@/shared/ui/smart-selector";
import { useFloatingSelectorPosition } from "@/shared/ui/floating-selector";

interface SearchMultiSelectorProps {
  items: SmartSelectorItem[];
  value: string[];
  onChange: (ids: string[]) => void;
  onCreateNew?: () => void;
  placeholder?: string;
  createLabel?: string;
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
  placement?: "auto" | "top" | "bottom";
  offset?: number;
  maxPanelHeight?: number;
  emptyText?: string;
}

export function SearchMultiSelector({
  items,
  value,
  onChange,
  onCreateNew,
  placeholder = vi.common.searchPlaceholder,
  createLabel = vi.common.create,
  disabled,
  isLoading,
  className,
  placement = "auto",
  offset = 8,
  maxPanelHeight = 320,
  emptyText = vi.common.noResults,
}: SearchMultiSelectorProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { position, updatePosition } = useFloatingSelectorPosition(triggerRef, isOpen, {
    placement,
    offset,
    maxPanelHeight,
  });

  const selectedItems = useMemo(
    () => items.filter((item) => value.includes(item.id)),
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

  const handleToggle = (itemId: string) => {
    onChange(
      value.includes(itemId)
        ? value.filter((current) => current !== itemId)
        : [...value, itemId],
    );
  };

  const handleSelect = (itemId: string) => {
    handleToggle(itemId);
    setQuery("");
    inputRef.current?.focus();
  };

  const handleRemoveChip = (itemId: string) => {
    onChange(value.filter((current) => current !== itemId));
  };

  const dropdown = isOpen ? (
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
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 px-4 py-8 text-[13px] text-[var(--fg-muted)]">
            <Loader2 className="size-4 animate-spin text-[var(--accent)]" />
            {vi.common.loadingData}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-[12px] font-medium text-[var(--fg-muted)]">
            {emptyText}
          </div>
        ) : (
          filtered.map((item) => {
            const selected = value.includes(item.id);

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
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
      <div
        ref={triggerRef}
        role="button"
        tabIndex={0}
        onClick={() => {
          if (disabled) {
            return;
          }

          updatePosition();
          setIsOpen(true);
        }}
        onKeyDown={(event) => {
          if (disabled) {
            return;
          }

          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            updatePosition();
            setIsOpen(true);
          }
        }}
        className={cn(
          "flex min-h-11 cursor-text flex-col gap-2 rounded-xl border-2 bg-[var(--surface-light)] p-3 transition-all",
          disabled
            ? "cursor-not-allowed opacity-60"
            : isOpen
              ? "border-[var(--accent)] ring-4 ring-[var(--accent)]/10"
              : "border-[var(--border-soft)] hover:border-[var(--accent)]/40",
        )}
      >
        <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto">
          {selectedItems.map((item) => (
            <span
              key={item.id}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-2.5 py-1 text-[11px] font-bold text-white shadow-sm"
            >
              <span className="max-w-[11rem] truncate">{item.label}</span>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  handleRemoveChip(item.id);
                }}
                className="rounded-full p-0.5 transition-colors hover:bg-white/20"
                aria-label={`Bỏ ${item.label}`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}

          <input
            ref={inputRef}
            className="flex-1 min-w-[120px] bg-transparent text-[13px] font-bold text-[var(--fg-base)] outline-none placeholder:font-normal placeholder:text-[var(--fg-muted)]"
            placeholder={value.length === 0 ? placeholder : ""}
            value={query}
            onClick={(event) => {
              event.stopPropagation();
              if (!isOpen && !disabled) {
                updatePosition();
                setIsOpen(true);
              }
            }}
            onChange={(event) => {
              setQuery(event.target.value);
              if (!isOpen && !disabled) {
                updatePosition();
                setIsOpen(true);
              }
            }}
            onFocus={() => {
              if (!isOpen && !disabled) {
                updatePosition();
                setIsOpen(true);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Backspace" && query.length === 0 && value.length > 0) {
                handleRemoveChip(value[value.length - 1]);
              }
            }}
            disabled={disabled}
          />
        </div>
      </div>
      {dropdown ? createPortal(dropdown, document.body) : null}
    </div>
  );
}
