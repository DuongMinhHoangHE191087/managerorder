// ── Shared types & helpers for short-link detail tabs ──
import type { ShortLinkRow } from "@/lib/supabase/repositories/short-links.repo";
import { formatDateLabel } from "@/lib/utils";
import { vi } from "@/shared/messages/vi";

export interface ClickRecord {
  id: string;
  ip_address: string;
  user_agent: string | null;
  referer: string | null;
  country: string | null;
  device_type: string | null;
  event_type: "bot_preview" | "landing_view" | "redirect_click" | "blocked";
  is_suspicious: boolean;
  suspicious_reason: string | null;
  clicked_at: string;
}

export interface ClickStats {
  totalClicks: number;
  uniqueIPs: number;
  suspiciousCount: number;
  devices: Record<string, number>;
  browsers: Record<string, number>;
  topIPs: Array<{ ip: string; count: number }>;
  referers: Record<string, number>;
  hourlyTimeline: Array<{ hour: string; count: number }>;
  dailyTimeline: Array<{ day: string; count: number }>;
}

export interface TabProps {
  link: ShortLinkRow;
  clicks: ClickRecord[];
  stats: ClickStats | null;
  isLoading: boolean;
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return vi.legacy.timeAgo.justNow;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return vi.legacy.timeAgo.minutes(minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return vi.legacy.timeAgo.hours(hours);
  const days = Math.floor(hours / 24);
  return vi.legacy.timeAgo.days(days);
}

export function formatDate(dateStr: string): string {
  return formatDateLabel(dateStr);
}

export function extractBrowser(ua: string | null): string {
  if (!ua) return vi.legacy.browser.unknown;
  const patterns: [RegExp, string][] = [
    [/Zalo\//i, vi.legacy.browser.zalo], [/TelegramBot/i, vi.legacy.browser.telegram], [/FBAN|FBAV/i, vi.legacy.browser.facebook],
    [/Edg\//i, vi.legacy.browser.edge], [/OPR\/|Opera/i, vi.legacy.browser.opera], [/Chrome\/[\d.]+.*Safari/i, vi.legacy.browser.chrome],
    [/Version\/[\d.]+.*Safari/i, vi.legacy.browser.safari], [/Firefox\//i, vi.legacy.browser.firefox], [/curl|wget|python/i, vi.legacy.browser.cliBot],
  ];
  for (const [re, name] of patterns) { if (re.test(ua)) return name; }
  return vi.legacy.browser.other;
}
