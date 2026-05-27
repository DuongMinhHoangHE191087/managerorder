"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Download, Key, Plus, Search, Zap } from "lucide-react";
import { INVENTORY_COPY as copy } from "../copy";

const SourceAccountImport = dynamic(() => import("@/widgets/pages/inventory/components/source-account-import").then((m) => ({ default: m.SourceAccountImport })), { ssr: false });

type InventoryPageHeaderProps = {
  onCreateAccountClick: () => void;
  onCreateKeyClick: () => void;
  onExportCSV: () => void;
  onSearchChange: (value: string) => void;
  onShowSmartMatch: () => void;
  searchQuery: string;
};

export const InventoryPageHeader = React.memo(function InventoryPageHeader({
  onCreateAccountClick,
  onCreateKeyClick,
  onExportCSV,
  onSearchChange,
  onShowSmartMatch,
  searchQuery,
}: InventoryPageHeaderProps) {
  return (
    <div className="mb-2 mt-2 flex flex-col gap-4 rounded-[1.2rem] border border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,244,0.84))] px-5 py-5 shadow-[0_18px_44px_rgba(15,23,42,0.05)] lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h2 className="text-3xl font-black tracking-tight text-[var(--fg-base)]">{copy.header.title}</h2>
        <p className="mt-1 text-[15px] tracking-wide text-[var(--fg-muted)]">
          {copy.header.description}
        </p>
      </div>
      <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-center">
        <div className="relative w-full min-w-[220px] xl:w-[260px]">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--fg-muted)]" />
          <input
            className="w-full rounded-[1rem] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.84)] py-2 pl-9 pr-4 text-[13px] font-medium text-[var(--fg-base)] shadow-sm outline-none transition-[border-color,box-shadow] placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--ring)]"
            placeholder={copy.header.searchPlaceholder}
            type="text"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={onCreateKeyClick}
          className="flex items-center justify-center gap-2 rounded-[1rem] border border-[var(--border-soft)] bg-white px-4 py-2 text-[13px] font-bold text-[var(--fg-base)] shadow-sm transition-[box-shadow,transform] hover:shadow-md active:scale-[0.98]"
        >
          <Key className="size-4 text-[var(--accent)]" />
          {copy.header.createKey}
        </button>
        <button
          type="button"
          onClick={onShowSmartMatch}
          className="flex items-center justify-center gap-2 rounded-[1rem] border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-[13px] font-bold text-amber-500 shadow-sm transition-[background-color,transform] hover:bg-amber-500/20 active:scale-[0.98]"
        >
          <Zap className="size-4" />
          {copy.header.smartMatch}
        </button>
        <button
          type="button"
          onClick={onExportCSV}
          className="flex items-center justify-center gap-2 rounded-[1rem] border border-[var(--border-soft)] bg-white px-4 py-2 text-[13px] font-bold text-[var(--fg-base)] shadow-sm transition-[box-shadow,transform] hover:shadow-md active:scale-[0.98]"
        >
          <Download className="size-4 text-[var(--accent)]" />
          {copy.header.exportCsv}
        </button>
        <SourceAccountImport />
        <button
          type="button"
          onClick={onCreateAccountClick}
          className="flex items-center justify-center gap-2 rounded-[1rem] bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] px-4 py-2 text-[13px] font-bold text-white shadow-[0_16px_30px_rgba(var(--accent-rgb),0.2)] transition-[box-shadow,transform] hover:shadow-[0_20px_36px_rgba(var(--accent-rgb),0.28)] active:scale-[0.98]"
        >
          <Plus className="size-4" />
          {copy.header.createAccount}
        </button>
      </div>
    </div>
  );
});
