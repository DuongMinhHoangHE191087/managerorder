"use client";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { FiltersBar } from "@/shared/ui/page-layout";
import { Select } from "@/shared/ui/select";

export type AdminHistoryFilterValue = {
  mode: string;
  createdBy: string;
  fromDate: string;
  toDate: string;
};

export function AdminHistoryFilters({
  value,
  onChange,
  onApply,
  onReset,
  isLoading,
  modeOptions,
}: {
  value: AdminHistoryFilterValue;
  onChange: (next: AdminHistoryFilterValue) => void;
  onApply: () => void;
  onReset: () => void;
  isLoading?: boolean;
  modeOptions?: Array<{ value: string; label: string }>;
}) {
  const modes = modeOptions ?? [
    { value: "all", label: "Tất cả mode" },
    { value: "manual", label: "Manual" },
    { value: "cron", label: "Cron" },
  ];

  return (
    <FiltersBar className="items-end">
      <div className="min-w-[160px] flex-1">
        <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
          Mode
        </label>
        <Select
          value={value.mode}
          onChange={(event) => onChange({ ...value, mode: event.target.value })}
        >
          {modes.map((mode) => (
            <option key={mode.value} value={mode.value}>
              {mode.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="min-w-[190px] flex-[1.2]">
        <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
          created_by
        </label>
        <Input
          value={value.createdBy}
          placeholder="all | system | user id"
          onChange={(event) => onChange({ ...value, createdBy: event.target.value })}
        />
      </div>

      <div className="min-w-[160px] flex-1">
        <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
          Từ ngày
        </label>
        <Input
          type="date"
          value={value.fromDate}
          onChange={(event) => onChange({ ...value, fromDate: event.target.value })}
        />
      </div>

      <div className="min-w-[160px] flex-1">
        <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
          Đến ngày
        </label>
        <Input
          type="date"
          value={value.toDate}
          onChange={(event) => onChange({ ...value, toDate: event.target.value })}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={onReset} disabled={isLoading}>
          Reset
        </Button>
        <Button onClick={onApply} isLoading={isLoading}>
          Áp dụng
        </Button>
      </div>
    </FiltersBar>
  );
}
