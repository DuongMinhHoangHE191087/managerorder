"use client";

import { useState, useMemo, useCallback } from "react";
import { Settings, ChevronDown, ChevronRight, Check, Minus, Plus, X } from "lucide-react";
import {
  ORDER_IMPORT_FIELDS,
  DUOLINGO_EXTRA_FIELDS,
  FIELD_GROUP_META,
  CONTACT_CHANNEL_OPTIONS,
  type FieldGroup,
  type TargetField,
  type ContactChannelKey,
  type ImportDefaultValues,
} from "@/lib/utils";

interface ImportMappingGridProps {
  sheetNames: string[];
  selectedSheet: string;
  onSheetChange: (sheet: string) => void;
  rawExcelData: unknown[][];
  headerRowIndex: number;
  onHeaderRowChange: (index: number) => void;
  mapping: Record<string, number | undefined>;
  onMappingChange: (targetKey: string, excelColIndex: string) => void;
  currentHeaders: { index: number; text: string }[];
  /** Dynamic contact fields added by user via "+" button */
  dynamicContactFields: TargetField[];
  onAddContactField: (channel: ContactChannelKey) => void;
  onRemoveContactField: (key: string) => void;
  /** Dynamic duolingo extra fields added via "+" button */
  dynamicDuolingoFields: TargetField[];
  onAddDuolingoField: (fieldKey: string) => void;
  onRemoveDuolingoField: (key: string) => void;
  /** Default values applied to all records */
  defaultValues: ImportDefaultValues;
  onDefaultValuesChange: (values: ImportDefaultValues) => void;
}

export function ImportMappingGrid({
  sheetNames,
  selectedSheet,
  onSheetChange,
  rawExcelData,
  headerRowIndex,
  onHeaderRowChange,
  mapping,
  onMappingChange,
  currentHeaders,
  dynamicContactFields,
  onAddContactField,
  onRemoveContactField,
  dynamicDuolingoFields,
  onAddDuolingoField,
  onRemoveDuolingoField,
  defaultValues,
  onDefaultValuesChange,
}: ImportMappingGridProps) {
  // Groups that are expanded (core and contact always expanded)
  const [expandedGroups, setExpandedGroups] = useState<Set<FieldGroup>>(new Set(['core', 'contact']));
  const [showChannelPicker, setShowChannelPicker] = useState(false);
  const [showDuolingoPicker, setShowDuolingoPicker] = useState(false);

  // Build grouped fields, including dynamic contact + duolingo fields
  const allFields = useMemo(() => {
    return [...ORDER_IMPORT_FIELDS, ...dynamicContactFields, ...dynamicDuolingoFields];
  }, [dynamicContactFields, dynamicDuolingoFields]);

  const groupedFields = useMemo(() => {
    const groups: Record<FieldGroup, TargetField[]> = {
      core: [], customer: [], contact: [], payment: [], duolingo: [], other: []
    };
    allFields.forEach(f => groups[f.group].push(f));
    return groups;
  }, [allFields]);

  // Count mapped fields per group
  const groupMappedCount = useMemo(() => {
    const counts: Record<FieldGroup, { mapped: number; total: number }> = {
      core: { mapped: 0, total: 0 }, customer: { mapped: 0, total: 0 },
      contact: { mapped: 0, total: 0 },
      payment: { mapped: 0, total: 0 }, duolingo: { mapped: 0, total: 0 },
      other: { mapped: 0, total: 0 }
    };
    allFields.forEach(f => {
      counts[f.group].total++;
      if (mapping[f.key] !== undefined) counts[f.group].mapped++;
    });
    return counts;
  }, [mapping, allFields]);

  // Channels already in use (static + dynamic)
  const usedChannels = useMemo(() => {
    const used = new Set<ContactChannelKey>();
    allFields.filter(f => f.contactChannel).forEach(f => used.add(f.contactChannel!));
    return used;
  }, [allFields]);

  // Available channels for the "+" picker
  const availableChannels = useMemo(() => {
    return CONTACT_CHANNEL_OPTIONS.filter(ch => !usedChannels.has(ch.key));
  }, [usedChannels]);

  // Available duolingo extra fields for the "+" picker
  const usedDuolingoKeys = useMemo(() => {
    return new Set(dynamicDuolingoFields.map(f => f.key));
  }, [dynamicDuolingoFields]);

  const availableDuolingoExtras = useMemo(() => {
    return DUOLINGO_EXTRA_FIELDS.filter(f => !usedDuolingoKeys.has(f.key));
  }, [usedDuolingoKeys]);

  const toggleGroup = useCallback((group: FieldGroup) => {
    if (group === 'core') return;
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group); else next.add(group);
      return next;
    });
  }, []);

  const isDynamicField = useCallback((key: string) => {
    return dynamicContactFields.some(f => f.key === key) || dynamicDuolingoFields.some(f => f.key === key);
  }, [dynamicContactFields, dynamicDuolingoFields]);

  const handleRemoveDynamicField = useCallback((key: string) => {
    if (dynamicContactFields.some(f => f.key === key)) {
      onRemoveContactField(key);
    } else {
      onRemoveDuolingoField(key);
    }
  }, [dynamicContactFields, onRemoveContactField, onRemoveDuolingoField]);

  return (
    <div className="space-y-5">
      {/* Header info banner */}
      <div className="bg-[var(--accent)]/5 border border-[var(--accent)]/20 rounded-xl p-4 flex gap-4 items-start">
        <Settings className="size-5 text-[var(--accent)] mt-0.5 shrink-0" />
        <div className="w-full">
          <h4 className="text-sm font-bold text-[var(--fg-base)] mb-1">Cấu hình Cột</h4>
          <p className="text-[13px] text-[var(--fg-muted)]">
            Hệ thống đã tự động ghép cột bằng AI. Nhấn <strong>➕</strong> để thêm kênh liên lạc hoặc thông tin Duolingo.
          </p>
        </div>
      </div>

      {/* Sheet + Header row selectors */}
      <div className="flex flex-wrap gap-3">
        {sheetNames.length > 1 && (
          <div className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-[var(--border-soft)] shadow-sm flex-1 min-w-[200px]">
            <span className="text-[13px] font-medium text-[var(--fg-base)] shrink-0">Sheet:</span>
            <select
              className="block w-full rounded-md border-0 py-1 pl-2 pr-8 text-sm text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-[var(--accent)]"
              value={selectedSheet}
              onChange={(e) => onSheetChange(e.target.value)}
            >
              {sheetNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-[var(--border-soft)] shadow-sm flex-1 min-w-[200px]">
          <span className="text-[13px] font-medium text-[var(--fg-base)] shrink-0">Dòng Tiêu Đề:</span>
          <select
            className="block w-full rounded-md border-0 py-1 pl-2 pr-8 text-sm text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-[var(--accent)]"
            value={headerRowIndex}
            onChange={(e) => onHeaderRowChange(Number(e.target.value))}
          >
            {rawExcelData.slice(0, 20).map((row, i) => (
              <option key={i} value={i}>
                Dòng {i + 1}: {row.filter(c => !!c).join(" | ").substring(0, 50)}{(row as unknown[]).join('').length > 50 ? '...' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ====== Default Values Section ====== */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">⚙️</span>
          <h4 className="text-sm font-bold text-[var(--fg-base)]">Dữ Liệu Cố Định (áp dụng tất cả bản ghi)</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Quantity default */}
          <div className="flex flex-col gap-1.5 p-3 rounded-lg border border-amber-200 bg-white">
            <label className="text-[13px] font-medium text-[var(--fg-base)]">
              📦 Số Lượng mặc định
            </label>
            <input
              type="number"
              min={1}
              value={defaultValues.quantity}
              onChange={(e) => onDefaultValuesChange({ ...defaultValues, quantity: Math.max(1, Number(e.target.value) || 1) })}
              className="block w-full rounded-md border-0 py-1.5 pl-3 pr-3 text-sm text-gray-900 ring-1 ring-inset ring-amber-300 focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
        </div>
        <p className="text-[11px] text-[var(--fg-muted)] mt-2">
          💡 Trạng thái thanh toán, ngày bắt đầu, ngày hết hạn sẽ được lấy từ dữ liệu Excel.
        </p>
      </div>

      {/* Grouped field mapping */}
      <div className="space-y-3">
        {(Object.keys(groupedFields) as FieldGroup[]).map(group => {
          const fields = groupedFields[group];
          if (fields.length === 0 && group !== 'contact' && group !== 'duolingo') return null;

          const meta = FIELD_GROUP_META[group];
          const isExpanded = expandedGroups.has(group);
          const isCore = group === 'core';
          const isContact = group === 'contact';
          const isDuolingo = group === 'duolingo';
          const { mapped, total } = groupMappedCount[group];
          const allMapped = mapped === total && total > 0;

          return (
            <div
              key={group}
              className={`rounded-xl border transition-[background-color,border-color] ${
                isCore
                  ? 'border-[var(--accent)]/30 bg-[var(--accent)]/3'
                  : isContact
                    ? 'border-blue-200 bg-blue-50/50'
                    : isDuolingo
                      ? 'border-purple-200 bg-purple-50/50'
                      : isExpanded
                        ? 'border-[var(--border-soft)] bg-white'
                        : 'border-[var(--border-soft)] bg-[var(--bg-subtle)]'
              }`}
            >
              {/* Group header */}
              <button
                type="button"
                onClick={() => toggleGroup(group)}
                disabled={isCore}
                className={`w-full flex items-center gap-3 p-3.5 text-left transition-colors ${
                  isCore ? 'cursor-default' : 'cursor-pointer hover:bg-black/3'
                } rounded-t-xl`}
              >
                {!isCore && (
                  isExpanded
                    ? <ChevronDown className="size-4 text-[var(--fg-muted)]" />
                    : <ChevronRight className="size-4 text-[var(--fg-muted)]" />
                )}
                <span className="text-base">{meta.icon}</span>
                <span className="text-sm font-bold text-[var(--fg-base)] flex-1">{meta.label}</span>

                {/* Mapped count badge */}
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                  allMapped
                    ? 'bg-emerald-100 text-emerald-700'
                    : mapped > 0
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-gray-100 text-gray-500'
                }`}>
                  {allMapped ? (
                    <><Check className="size-3" /> {mapped}/{total}</>
                  ) : (
                    <><Minus className="size-3" /> {mapped}/{total}</>
                  )}
                </span>

                {isCore && (
                  <span className="text-[11px] font-medium text-[var(--danger)] bg-[var(--danger)]/10 px-2 py-0.5 rounded-full">
                    Bắt buộc
                  </span>
                )}
              </button>

              {/* Fields */}
              {isExpanded && (
                <div className="px-3.5 pb-3.5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {fields.map(field => {
                      const isMapped = mapping[field.key] !== undefined;
                      const isDynamic = isDynamicField(field.key);
                      const channelOption = field.contactChannel
                        ? CONTACT_CHANNEL_OPTIONS.find(c => c.key === field.contactChannel)
                        : null;

                      return (
                        <div
                          key={field.key}
                          className={`flex flex-col gap-1.5 p-3 rounded-lg border transition-[background-color,border-color] ${
                            isMapped
                              ? 'border-emerald-200 bg-emerald-50/50'
                              : field.required
                                ? 'border-[var(--danger)]/30 bg-[var(--danger)]/5'
                                : 'border-[var(--border-soft)] bg-white'
                          }`}
                        >
                          <label className="text-[13px] font-medium text-[var(--fg-base)] flex items-center gap-1.5">
                            {isMapped && <Check className="size-3.5 text-emerald-600" />}
                            {channelOption && (
                              <span
                                className="inline-flex items-center justify-center size-5 rounded text-[11px]"
                                style={{ backgroundColor: channelOption.color + '20', color: channelOption.color }}
                              >
                                {channelOption.icon}
                              </span>
                            )}
                            {field.label}
                            {field.required && <span className="text-[var(--danger)] text-xs">(bắt buộc)</span>}
                            {isDynamic && (
                              <button
                                type="button"
                                onClick={() => handleRemoveDynamicField(field.key)}
                                className="ml-auto p-0.5 rounded hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors"
                                title="Xóa trường này"
                              >
                                <X className="size-3.5" />
                              </button>
                            )}
                          </label>
                          <select
                            className={`block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-sm text-gray-900 ring-1 ring-inset focus:ring-2 focus:ring-[var(--accent)] ${
                              !isMapped && field.required
                                ? 'ring-[var(--danger)]'
                                : isMapped
                                  ? 'ring-emerald-300'
                                  : 'ring-gray-300'
                            }`}
                            value={mapping[field.key] ?? ""}
                            onChange={(e) => onMappingChange(field.key, e.target.value)}
                          >
                            <option value="">-- Bỏ qua --</option>
                            {currentHeaders.map((header) => (
                              <option key={header.index} value={header.index}>
                                {header.text} (Cột {header.index + 1})
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>

                  {/* "+" Add contact channel button — only in contact group */}
                  {isContact && availableChannels.length > 0 && (
                    <div className="mt-3 relative">
                      <button
                        type="button"
                        onClick={() => setShowChannelPicker(!showChannelPicker)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed border-blue-300 text-blue-600 text-sm font-medium hover:bg-blue-50 transition-[background-color,border-color,color] w-full justify-center"
                      >
                        <Plus className="size-4" />
                        Thêm kênh liên lạc
                      </button>

                      {/* Channel picker dropdown */}
                      {showChannelPicker && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[var(--border-soft)] rounded-xl shadow-lg z-10 p-2 grid grid-cols-2 gap-1">
                          {availableChannels.map(ch => (
                            <button
                              key={ch.key}
                              type="button"
                              onClick={() => {
                                onAddContactField(ch.key);
                                setShowChannelPicker(false);
                              }}
                              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left"
                            >
                              <span
                                className="inline-flex items-center justify-center size-7 rounded-lg text-sm"
                                style={{ backgroundColor: ch.color + '15', color: ch.color }}
                              >
                                {ch.icon}
                              </span>
                              <span className="text-sm font-medium text-[var(--fg-base)]">{ch.label}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* "+" Add Duolingo extra field button — only in duolingo group */}
                  {isDuolingo && availableDuolingoExtras.length > 0 && (
                    <div className="mt-3 relative">
                      <button
                        type="button"
                        onClick={() => setShowDuolingoPicker(!showDuolingoPicker)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed border-purple-300 text-purple-600 text-sm font-medium hover:bg-purple-50 transition-[background-color,border-color,color] w-full justify-center"
                      >
                        <Plus className="size-4" />
                        Thêm thông tin Duolingo
                      </button>

                      {/* Duolingo picker dropdown */}
                      {showDuolingoPicker && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[var(--border-soft)] rounded-xl shadow-lg z-10 p-2 grid grid-cols-1 gap-1">
                          {availableDuolingoExtras.map(f => (
                            <button
                              key={f.key}
                              type="button"
                              onClick={() => {
                                onAddDuolingoField(f.key);
                                setShowDuolingoPicker(false);
                              }}
                              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left"
                            >
                              <span className="inline-flex items-center justify-center size-7 rounded-lg text-sm bg-purple-100 text-purple-600">
                                📋
                              </span>
                              <span className="text-sm font-medium text-[var(--fg-base)]">{f.label}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
