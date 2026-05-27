"use client";

import { useState, useRef, useEffect } from "react";
import { X, Plus, Tag, ChevronDown } from "lucide-react";
import { useCustomerTags, useCreateTag } from "@/widgets/pages/customers/hooks/use-customer-tags";
import { TAG_PALETTE } from "@/lib/constants/colors";
import type { CustomerTag } from "@/shared/types/customers";
import { vi } from "@/shared/messages/vi";

interface CustomerTagPickerProps {
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
  /** Compact mode for inline use in tables */
  compact?: boolean;
}

const TAG_COLORS = TAG_PALETTE.slice(0, 8);

export function CustomerTagPicker({ selectedTagIds, onChange, compact }: CustomerTagPickerProps) {
  const { data: tags = [] } = useCustomerTags();
  const createTag = useCreateTag();
  const [isOpen, setIsOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  function toggleTag(tagId: string) {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter(id => id !== tagId));
    } else {
      onChange([...selectedTagIds, tagId]);
    }
  }

  async function handleCreateTag() {
    const trimmed = newTagName.trim();
    if (!trimmed) return;
    try {
      const result = await createTag.mutateAsync({ name: trimmed, color: newTagColor });
      const newTag = result.data as CustomerTag;
      if (newTag?.id) {
        onChange([...selectedTagIds, newTag.id]);
      }
      setNewTagName("");
      setNewTagColor(TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)]);
    } catch {
      // handled by hook
    }
  }

  const selectedTags = tags.filter(t => selectedTagIds.includes(t.id));

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Selected tags display — div instead of button to avoid nested button violation */}
      <div
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls="customer-tag-listbox"
        tabIndex={0}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        className={`flex items-center gap-2 flex-wrap w-full border border-[var(--border-soft)] rounded-xl transition-[background-color,border-color,box-shadow,color,opacity,transform,width] hover:border-[var(--accent)]/40 cursor-pointer ${
          compact ? "px-2 py-1.5 min-h-[32px]" : "px-3 py-2.5 min-h-[44px]"
        } bg-[#f8f9fa] text-left`}
      >
        {selectedTags.length > 0 ? (
          selectedTags.map(tag => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold"
              style={{
                backgroundColor: `${tag.color}15`,
                color: tag.color,
                border: `1px solid ${tag.color}40`,
              }}
            >
              {tag.name}
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); toggleTag(tag.id); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation();
                    e.preventDefault();
                    toggleTag(tag.id);
                  }
                }}
                className="hover:opacity-70 cursor-pointer"
              >
                <X className="size-3" />
              </span>
            </span>
          ))
        ) : (
          <span className="text-[var(--fg-muted)] text-[13px] font-medium flex items-center gap-1.5">
            <Tag className="size-3.5" />
            {vi.customers.tagPicker.placeholder}
          </span>
        )}
        <ChevronDown className={`size-3.5 text-[var(--fg-muted)] ml-auto shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div id="customer-tag-listbox" role="listbox" className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-[var(--border-soft)] rounded-xl shadow-lg z-50 max-h-64 overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-150">
          {/* Existing tags */}
          <div className="p-2 space-y-1">
            {tags.length === 0 && (
              <p className="text-[12px] text-[var(--fg-muted)] text-center py-3">{vi.customers.tagPicker.noTags}</p>
            )}
            {tags.map(tag => {
              const isSelected = selectedTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-[background-color,border-color,box-shadow,color,opacity,transform,width] text-[13px] font-medium ${
                    isSelected
                      ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                      : "hover:bg-gray-50 text-[var(--fg-base)]"
                  }`}
                >
                  <span
                    className="size-3 rounded-full shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="flex-1 truncate">{tag.name}</span>
                  {isSelected && (
                    <span className="text-[10px] font-bold text-[var(--accent)] bg-[var(--accent)]/10 px-1.5 py-0.5 rounded">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Create new tag */}
          <div className="border-t border-[var(--border-soft)] p-2">
            <div className="flex gap-1.5">
              <div className="flex gap-1 items-center">
                {TAG_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewTagColor(color)}
                    className={`size-5 rounded-full transition-[background-color,border-color,box-shadow,color,opacity,transform,width] ${
                      newTagColor === color ? "ring-2 ring-offset-1 ring-[var(--accent)]" : "hover:scale-110"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-1.5 mt-2">
              <input
                type="text"
                value={newTagName}
                onChange={e => setNewTagName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleCreateTag()}
                placeholder={vi.customers.tagPicker.newTagPlaceholder}
                className="flex-1 px-3 py-1.5 border border-[var(--border-soft)] rounded-lg text-[12px] outline-none focus:border-[var(--accent)]"
              />
              <button
                type="button"
                onClick={handleCreateTag}
                disabled={!newTagName.trim() || createTag.isPending}
                className="px-2.5 py-1.5 bg-[var(--accent)] text-white rounded-lg text-[12px] font-bold disabled:opacity-50 flex items-center gap-1"
              >
                <Plus className="size-3" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
