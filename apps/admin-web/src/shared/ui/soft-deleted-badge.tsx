import { Trash2 } from "lucide-react";

import { vi } from "@/shared/messages/vi";
import { cn } from "@/lib/utils";

interface SoftDeletedBadgeProps {
  className?: string;
}

export function SoftDeletedBadge({ className }: SoftDeletedBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-rose-500/15 bg-rose-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-rose-700",
        className,
      )}
    >
      <Trash2 className="size-3.5" />
      {vi.trash.page.softDeleted}
    </span>
  );
}
