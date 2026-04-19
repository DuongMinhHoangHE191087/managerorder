"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/lib/api/fetcher";
import type { ShortLinkRow } from "@/lib/supabase/repositories/short-links.repo";
import { Link2, ArrowUpRight, Plus, Clock, CheckCircle2 } from "lucide-react";
import { StaggerContainer, StaggerItem } from "@/shared/ui/animations";

/**
 * Dashboard widget showing short-link statistics & recent links.
 * Lazy-loaded in the dashboard to avoid bundle bloat.
 */
export function ShortLinksWidget() {
  const { data: links = [], isLoading } = useQuery<ShortLinkRow[]>({
    queryKey: ["short-links"],
    queryFn: () => fetcher("/api/short-links"),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const activeCount = links.filter(l => l.status === "active").length;
  const expiredCount = links.filter(l => l.status !== "active").length;
  const totalClicks = links.reduce((s, l) => s + l.current_clicks, 0);
  const recent = links.slice(0, 5);

  if (isLoading) {
    return (
      <div className="glass-card rounded-ios border border-[var(--border-soft)] shadow-sm flex flex-col hover:shadow-md transition-shadow animate-pulse">
        <div className="p-5 border-b border-[var(--border-soft)] bg-[var(--bg-app)]/50 backdrop-blur-sm">
          <div className="h-5 w-32 bg-[var(--border-soft)] rounded" />
        </div>
        <div className="p-4 space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-12 bg-[var(--border-soft)] rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-ios border border-[var(--border-soft)] shadow-sm flex flex-col hover:shadow-md transition-shadow">
      <div className="p-5 border-b border-[var(--border-soft)] bg-[var(--bg-app)]/50 backdrop-blur-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 className="size-4 text-[var(--accent)]" />
          <h3 className="font-bold text-[15px] tracking-tight text-[var(--fg-base)]">Link rút gọn</h3>
        </div>
        <Link
          href="/short-links"
          className="text-[11px] font-bold text-[var(--accent)] hover:underline flex items-center gap-1"
        >
          Quản lý <ArrowUpRight className="size-3" />
        </Link>
      </div>

      {/* Mini KPIs */}
      <div className="grid grid-cols-3 border-b border-[var(--border-soft)]">
        <div className="p-3 text-center border-r border-[var(--border-soft)]">
          <p className="text-lg font-black text-emerald-600">{activeCount}</p>
          <p className="text-[9px] font-bold text-[var(--fg-muted)] uppercase tracking-wider">Active</p>
        </div>
        <div className="p-3 text-center border-r border-[var(--border-soft)]">
          <p className="text-lg font-black text-amber-600">{expiredCount}</p>
          <p className="text-[9px] font-bold text-[var(--fg-muted)] uppercase tracking-wider">Expired</p>
        </div>
        <div className="p-3 text-center">
          <p className="text-lg font-black text-blue-600">{totalClicks}</p>
          <p className="text-[9px] font-bold text-[var(--fg-muted)] uppercase tracking-wider">Clicks</p>
        </div>
      </div>

      {/* Recent links list */}
      <StaggerContainer delayChildren={0.3} staggerDelay={0.08} className="p-3 space-y-1 flex-1">
        {recent.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Link2 className="size-8 text-[var(--fg-muted)]/20 mb-2" />
            <p className="text-[11px] text-[var(--fg-muted)]">Chưa có link nào</p>
          </div>
        ) : (
          recent.map(link => {
            const isActive = link.status === "active";
            const progress = link.max_clicks > 0 ? Math.round((link.current_clicks / link.max_clicks) * 100) : 0;

            return (
              <StaggerItem key={link.id} yOffset={8}>
                <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-[var(--surface-light)] transition-colors group">
                  <div className={`size-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isActive ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
                  }`}>
                    {isActive ? <CheckCircle2 className="size-3.5" /> : <Clock className="size-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-[var(--fg-base)] truncate group-hover:text-[var(--accent)] transition-colors">
                      {link.title || link.slug}
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1 bg-[var(--border-soft)] rounded-full overflow-hidden max-w-[80px]">
                        <div
                          className={`h-full rounded-full ${progress >= 100 ? "bg-red-500" : "bg-emerald-500"}`}
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-[var(--fg-muted)]">
                        {link.current_clicks}/{link.max_clicks}
                      </span>
                    </div>
                  </div>
                </div>
              </StaggerItem>
            );
          })
        )}
      </StaggerContainer>

      {/* Footer */}
      <div className="mt-auto p-3 border-t border-[var(--border-soft)] bg-[var(--surface-light)]/30">
        <Link
          href="/short-links"
          className="flex items-center justify-center gap-2 w-full text-[12px] font-bold text-[var(--accent)] py-1.5 hover:bg-[var(--accent)]/10 rounded-lg transition-colors active:scale-95"
        >
          <Plus className="size-3.5" />
          Tạo link rút gọn mới
        </Link>
      </div>
    </div>
  );
}
