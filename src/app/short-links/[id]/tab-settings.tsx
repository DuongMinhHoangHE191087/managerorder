"use client";

import { useState, memo } from "react";
import {
  Settings, Pencil, Save, X, Loader2, Power, Eye, ShieldCheck,
  Bell, CalendarDays, Unlock, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { appToast } from "@/shared/ui/app-toast";
import { useUpdateShortLink } from "@/widgets/pages/short-links/hooks/use-short-links";
import type { ShortLinkRow } from "@/lib/supabase/repositories/short-links.repo";
import { formatDate } from "./detail-types";

interface SettingsTabProps {
  link: ShortLinkRow;
  onDelete: () => void;
}

function SettingsTab({ link, onDelete }: SettingsTabProps) {
  const updateMut = useUpdateShortLink();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "", notify_clicks: false, require_token: false,
    max_clicks: 5, status: "active", expires_at: "",
  });

  const statusColor = link.status === "active" ? "bg-emerald-100 text-emerald-600"
    : link.status === "expired" ? "bg-amber-100 text-amber-600"
    : "bg-red-100 text-red-500";
  const statusLabel = link.status === "active" ? "🟢 Hoạt động" : link.status === "expired" ? "🟡 Hết hạn" : "🔴 Đã tắt";

  const startEdit = () => {
    setEditForm({
      title: link.title || "",
      notify_clicks: link.notify_clicks ?? false,
      require_token: link.require_token ?? false,
      max_clicks: link.max_clicks,
      status: link.status,
      expires_at: link.expires_at ? new Date(link.expires_at).toISOString().slice(0, 16) : "",
    });
    setIsEditing(true);
  };

  const saveEdit = async () => {
    const updates: Record<string, unknown> = {};
    if (editForm.title !== (link.title ?? "")) updates.title = editForm.title || null;
    if (editForm.notify_clicks !== (link.notify_clicks ?? false)) updates.notify_clicks = editForm.notify_clicks;
    if (editForm.require_token !== (link.require_token ?? false)) updates.require_token = editForm.require_token;
    if (editForm.max_clicks !== link.max_clicks) updates.max_clicks = editForm.max_clicks;
    if (editForm.status !== link.status) updates.status = editForm.status;
    const newExpiry = editForm.expires_at ? new Date(editForm.expires_at).toISOString() : null;
    if (newExpiry !== (link.expires_at ?? null)) updates.expires_at = newExpiry;

    if (Object.keys(updates).length === 0) {
      appToast.info("Không có thay đổi");
      setIsEditing(false); return;
    }
    await updateMut.mutateAsync({ id: link.id, ...updates });
    setIsEditing(false);
  };

  const handleUnlockIP = async () => {
    await updateMut.mutateAsync({ id: link.id, locked_ip: null });
  };

  return (
    <div className="bg-[var(--bg-surface)] rounded-2xl shadow-sm overflow-hidden border border-[var(--border-soft)]">
      <div className="p-5 border-b border-[var(--border-soft)] flex justify-between items-center">
        <h3 className="text-[15px] font-bold text-[var(--fg-base)] flex items-center gap-2">
          <Settings className="text-[var(--accent)] size-5" />
          Cài đặt link
        </h3>
        {!isEditing ? (
          <button onClick={startEdit} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold text-[var(--accent)] bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 rounded-lg transition-colors cursor-pointer">
            <Pencil className="size-3.5" /> Chỉnh sửa
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={saveEdit} disabled={updateMut.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors cursor-pointer disabled:opacity-50">
              {updateMut.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Lưu
            </button>
            <button onClick={() => setIsEditing(false)}
              className="flex items-center gap-1 px-3 py-1.5 text-[12px] font-bold text-[var(--fg-muted)] hover:text-[var(--fg-base)] transition-colors cursor-pointer">
              <X className="size-3.5" /> Huỷ
            </button>
          </div>
        )}
      </div>

      <div className="p-5 space-y-5">
        {/* Title */}
        <SettingsRow icon={<Pencil className="size-4 text-slate-500" />} label="Tiêu đề" desc="Tên gợi nhớ cho link">
          {isEditing ? (
            <input type="text" value={editForm.title} placeholder="Nhập tiêu đề..."
              onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
              className="w-48 px-3 py-2 rounded-lg bg-white border border-[var(--border-soft)] text-sm text-[var(--fg-base)] font-bold focus:ring-2 focus:ring-[var(--accent)]/30 outline-none"
            />
          ) : (
            <span className="text-[13px] font-bold text-[var(--fg-base)]">{link.title || "—"}</span>
          )}
        </SettingsRow>

        {/* Status Toggle */}
        <SettingsRow icon={<Power className="size-4 text-emerald-500" />} label="Trạng thái" desc="Bật/tắt link">
          {isEditing ? (
            <select value={editForm.status}
              onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
              className="px-3 py-2 rounded-lg bg-white border border-[var(--border-soft)] text-sm text-[var(--fg-base)] font-bold focus:ring-2 focus:ring-[var(--accent)]/30 outline-none cursor-pointer"
            >
              <option value="active">🟢 Hoạt động</option>
              <option value="disabled">🔴 Đã tắt</option>
              <option value="expired">🟡 Hết hạn</option>
            </select>
          ) : (
            <span className={`px-3 py-1.5 rounded-lg text-[11px] font-bold ${statusColor}`}>{statusLabel}</span>
          )}
        </SettingsRow>

        {/* Expiry Date */}
        <SettingsRow icon={<CalendarDays className="size-4 text-orange-500" />} label="Hạn sử dụng" desc="Link tự vô hiệu sau ngày này">
          {isEditing ? (
            <input type="datetime-local" value={editForm.expires_at}
              onChange={e => setEditForm(f => ({ ...f, expires_at: e.target.value }))}
              className="px-3 py-2 rounded-lg bg-white border border-[var(--border-soft)] text-sm text-[var(--fg-base)] font-bold focus:ring-2 focus:ring-[var(--accent)]/30 outline-none"
            />
          ) : (
            <span className="text-[13px] font-bold text-[var(--fg-base)]">
              {link.expires_at ? formatDate(link.expires_at) : "Không giới hạn"}
            </span>
          )}
        </SettingsRow>

        {/* Max Clicks */}
        <SettingsRow icon={<Eye className="size-4 text-purple-500" />} label="Giới hạn click" desc="Số lượt click tối đa trước khi tự vô hiệu">
          {isEditing ? (
            <input type="number" min={1} max={100} value={editForm.max_clicks}
              onChange={e => setEditForm(f => ({ ...f, max_clicks: Number(e.target.value) || 1 }))}
              className="w-20 px-3 py-2 rounded-lg bg-white border border-[var(--border-soft)] text-sm text-[var(--fg-base)] text-center font-bold focus:ring-2 focus:ring-[var(--accent)]/30 outline-none"
            />
          ) : (
            <span className="text-lg font-black text-[var(--fg-base)]">{link.max_clicks}</span>
          )}
        </SettingsRow>

        {/* Anti-Fraud Token */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-violet-50 border border-violet-200/30">
          <div>
            <p className="text-[13px] font-bold text-violet-700 flex items-center gap-2">
              <ShieldCheck className="size-4" /> Anti-Fraud Token
            </p>
            <p className="text-[11px] text-violet-600/70 mt-0.5">Bảo vệ bằng token + khoá IP người click đầu tiên</p>
          </div>
          {isEditing ? (
            <ToggleSwitch checked={editForm.require_token} onChange={v => setEditForm(f => ({ ...f, require_token: v }))} color="violet" />
          ) : (
            <span className={cn("px-3 py-1.5 rounded-lg text-[11px] font-bold",
              link.require_token ? "bg-violet-100 text-violet-600" : "bg-[var(--border-soft)] text-[var(--fg-muted)]"
            )}>
              {link.require_token ? "Đang bật" : "Tắt"}
            </span>
          )}
        </div>

        {/* Telegram Notifications */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-amber-50 border border-amber-200/30">
          <div>
            <p className="text-[13px] font-bold text-amber-700 flex items-center gap-2">
              <Bell className="size-4" /> Thông báo Telegram
            </p>
            <p className="text-[11px] text-amber-600/70 mt-0.5">Gửi thông báo mỗi khi có click mới (IP, thiết bị, trình duyệt)</p>
          </div>
          {isEditing ? (
            <ToggleSwitch checked={editForm.notify_clicks} onChange={v => setEditForm(f => ({ ...f, notify_clicks: v }))} color="amber" />
          ) : (
            <span className={cn("px-3 py-1.5 rounded-lg text-[11px] font-bold",
              link.notify_clicks ? "bg-amber-100 text-amber-600" : "bg-[var(--border-soft)] text-[var(--fg-muted)]"
            )}>
              {link.notify_clicks ? "Đang bật" : "Tắt"}
            </span>
          )}
        </div>

        {/* Danger Zone */}
        <div className="border-t border-[var(--border-soft)] pt-5 mt-5">
          <p className="text-[11px] font-bold text-red-500 uppercase tracking-wider mb-3">⚠️ Vùng nguy hiểm</p>
          <div className="flex gap-3">
            <button onClick={handleUnlockIP} disabled={!link.locked_ip}
              className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Unlock className="size-4" /> Gỡ khoá IP
            </button>
            <button onClick={onDelete}
              className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-all cursor-pointer"
            >
              <Trash2 className="size-4" /> Xoá vĩnh viễn
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────
function SettingsRow({ icon, label, desc, children }: { icon: React.ReactNode; label: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--border-soft)]/10">
      <div>
        <p className="text-[13px] font-bold text-[var(--fg-base)] flex items-center gap-2">{icon} {label}</p>
        <p className="text-[11px] text-[var(--fg-muted)] mt-0.5">{desc}</p>
      </div>
      {children}
    </div>
  );
}

function ToggleSwitch({ checked, onChange, color }: { checked: boolean; onChange: (v: boolean) => void; color: string }) {
  const colorMap: Record<string, string> = {
    violet: "bg-violet-500",
    amber: "bg-amber-500",
    emerald: "bg-emerald-500",
    blue: "bg-blue-500",
  };
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "relative w-12 h-7 rounded-full transition-colors cursor-pointer flex-shrink-0",
        checked ? (colorMap[color] ?? "bg-blue-500") : "bg-slate-300"
      )}
    >
      <div className={cn(
        "absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform",
        checked ? "translate-x-[22px]" : "translate-x-0.5"
      )} />
    </button>
  );
}

export default memo(SettingsTab);
