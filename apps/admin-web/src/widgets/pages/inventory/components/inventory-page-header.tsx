"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Download, Key, Plus, Search, Zap } from "lucide-react";
import { PageHeader } from "@/shared/ui/page-layout";
import { Button } from "@/shared/ui/button";
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
    <PageHeader
      title={copy.header.title}
      eyebrow="Inventory Workspace"
      className="mt-2"
      actions={
        <>
          <div className="relative min-w-[200px] xl:w-[220px]">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--fg-muted)]" />
            <input
              className="w-full rounded-xl border border-[var(--border-soft)] bg-[rgba(255,255,255,0.84)] py-2 pl-9 pr-4 text-[13px] font-medium text-[var(--fg-base)] shadow-sm outline-none transition-[border-color,box-shadow] placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--ring)]"
              placeholder={copy.header.searchPlaceholder}
              type="text"
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </div>
          <Button type="button" variant="secondary" onClick={onCreateKeyClick}>
            <Key className="size-4 text-[var(--accent)]" />
            {copy.header.createKey}
          </Button>
          <button
            type="button"
            onClick={onShowSmartMatch}
            className="flex items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-[13px] font-bold text-amber-500 shadow-sm transition-[background-color,transform] hover:bg-amber-500/20 active:scale-[0.98]"
          >
            <Zap className="size-4" />
            {copy.header.smartMatch}
          </button>
          <Button type="button" variant="secondary" onClick={onExportCSV}>
            <Download className="size-4 text-[var(--accent)]" />
            {copy.header.exportCsv}
          </Button>
          <SourceAccountImport />
          <Button type="button" variant="primary" onClick={onCreateAccountClick}>
            <Plus className="size-4" />
            {copy.header.createAccount}
          </Button>
        </>
      }
    />
  );
});
