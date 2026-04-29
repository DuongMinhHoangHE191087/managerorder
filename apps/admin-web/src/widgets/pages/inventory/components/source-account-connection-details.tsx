"use client";

import { memo } from "react";
import { Info, Loader2 } from "lucide-react";
import { useConnectionsEnriched } from "@/widgets/pages/inventory/hooks/use-source-accounts";
import { ConnectionDetailRow } from "@/widgets/pages/inventory/components/connection-detail-row";
import type { EnrichedConnection } from "@/lib/domain/types";

interface SourceAccountConnectionDetailsPanelProps {
  sourceAccountId: string;
  productMap: Map<string, string>;
}

export const SourceAccountConnectionDetailsPanel = memo(function SourceAccountConnectionDetailsPanel({
  sourceAccountId,
  productMap,
}: SourceAccountConnectionDetailsPanelProps) {
  const {
    data: enrichedConnections,
    error,
    isLoading,
  } = useConnectionsEnriched(sourceAccountId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-[1.15rem] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.9)] py-12">
        <Loader2 className="size-5 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[1.15rem] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.9)] py-12 text-center text-[var(--fg-muted)]">
        <Info className="mx-auto mb-2 size-8 opacity-50" />
        <p className="text-[13px] font-medium">Không thể tải chi tiết kết nối.</p>
      </div>
    );
  }

  const connections = (enrichedConnections as EnrichedConnection[] | undefined) ?? [];

  if (connections.length === 0) {
    return (
      <div className="rounded-[1.15rem] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.9)] py-12 text-center text-[var(--fg-muted)]">
        <Info className="mx-auto mb-2 size-8 opacity-50" />
        <p className="text-[13px] font-medium">Chưa có kết nối enriched nào.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {connections.map((connection) => (
        <ConnectionDetailRow key={connection.id} connection={connection} productMap={productMap} />
      ))}
    </div>
  );
});
