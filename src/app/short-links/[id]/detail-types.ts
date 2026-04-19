// ── Shared types & helpers for short-link detail tabs ──
import type { ShortLinkRow } from "@/lib/supabase/repositories/short-links.repo";
import { formatDateLabel } from "@/lib/utils";

export interface ClickRecord {
  id: string;
  ip_address: string;
  user_agent: string | null;
  referer: string | null;
  country: string | null;
  device_type: string | null;
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
  if (diff < 60000) return "Vừa xong";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}

export function formatDate(dateStr: string): string {
  return formatDateLabel(dateStr);
}

export function extractBrowser(ua: string | null): string {
  if (!ua) return "Unknown";
  const patterns: [RegExp, string][] = [
    [/Zalo\//i, "Zalo"], [/TelegramBot/i, "Telegram"], [/FBAN|FBAV/i, "Facebook"],
    [/Edg\//i, "Edge"], [/OPR\/|Opera/i, "Opera"], [/Chrome\/[\d.]+.*Safari/i, "Chrome"],
    [/Version\/[\d.]+.*Safari/i, "Safari"], [/Firefox\//i, "Firefox"], [/curl|wget|python/i, "CLI/Bot"],
  ];
  for (const [re, name] of patterns) { if (re.test(ua)) return name; }
  return "Other";
}
