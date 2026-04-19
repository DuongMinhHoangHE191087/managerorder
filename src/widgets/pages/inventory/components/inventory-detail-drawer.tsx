"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Key, Link2, Shield, Zap, MoreHorizontal, Copy, Check, ExternalLink,
  Eye, EyeOff, Users, Edit2, ShieldAlert, Calendar, AlertTriangle,
  RefreshCw
} from "lucide-react";
import { appToast } from "@/shared/ui/app-toast";
import { formatDateLabel, formatMoney } from "@/lib/utils";
import type { SourceAccount, WarehouseCredential, WarehouseCredentialType } from "@/lib/domain/types";

const CRED_META: Record<WarehouseCredentialType, { label: string; icon: React.FC<{ className?: string }>; color: string; sensitive?: boolean }> = {
  link_join: { label: "Link Tham Gia", icon: Link2, color: "text-blue-500" },
  duolingo_id: { label: "Duolingo ID", icon: Zap, color: "text-green-500" },
  "2fa": { label: "Mã 2FA", icon: Shield, color: "text-amber-500", sensitive: true },
  "2fa_backup": { label: "Backup 2FA", icon: ShieldAlert, color: "text-red-500", sensitive: true },
  other: { label: "Khác", icon: MoreHorizontal, color: "text-gray-500" },
};

interface InventoryDetailDrawerProps {
  account: SourceAccount;
  productMap: Map<string, string>;
  providers: { id: string; name: string }[];
  onEdit: () => void;
  onRecalculate: () => Promise<void>;
  isRecalculating?: boolean;
  children?: React.ReactNode; // Connections + Activity panels
}

export function InventoryDetailDrawer({
  account,
  productMap,
  providers,
  onEdit,
  onRecalculate,
  isRecalculating,
  children,
}: InventoryDetailDrawerProps) {
  const [decryptedCreds, setDecryptedCreds] = useState<WarehouseCredential[]>([]);
  const [decryptedPassword, setDecryptedPassword] = useState<string | null>(null);
  const [loadingCreds, setLoadingCreds] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [visibleSensitive, setVisibleSensitive] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch decrypted credentials when account changes
  useEffect(() => {
    let cancelled = false;

    // Use a microtask to defer state resets (avoids set-state-in-effect lint)
    const run = async () => {
      setLoadingCreds(true);
      setDecryptedCreds([]);
      setDecryptedPassword(null);
      setShowPassword(false);
      setVisibleSensitive(new Set());

      try {
        const r = await fetch(`/api/source-accounts/${account.id}/decrypt`);
        if (cancelled) return;
        const json = r.ok ? await r.json() : null;
        if (cancelled) return;
        if (json?.data) {
          if (json.data.credentials?.length) setDecryptedCreds(json.data.credentials);
          if (json.data.password) setDecryptedPassword(json.data.password);
        }
      } catch {
        /* ignore errors */
      } finally {
        if (!cancelled) setLoadingCreds(false);
      }
    };

    void run();
    return () => { cancelled = true; };
  }, [account.id]);

  const handleCopy = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    appToast.success("Đã sao chép!");
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const toggleSensitive = (id: string) => {
    setVisibleSensitive(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Compute expiry info
  const [now] = useState(() => Date.now());
  const expiresDate = new Date(account.expiresAt);
  const daysUntilExpiry = Math.ceil((expiresDate.getTime() - now) / (1000 * 60 * 60 * 24));
  const isExpired = daysUntilExpiry < 0;
  const isExpiringSoon = daysUntilExpiry >= 0 && daysUntilExpiry <= 7;
  const slotsPercent = account.maxSlots > 0 ? Math.round((account.usedSlots / account.maxSlots) * 100) : 0;
  const isFull = account.usedSlots >= account.maxSlots;
  const freeSlots = Math.max(0, account.maxSlots - account.usedSlots);

  const providerName = providers.find(p => p.id === account.provider)?.name || account.provider;

  // Find invite link from credentials
  const inviteLink = decryptedCreds.find(c => c.type === "link_join")?.value;
  const duolingoInfo = decryptedCreds.find(c => c.type === "duolingo_id")?.value;

  return (
    <div className="space-y-5">
      {/* ═══ Quick Actions Bar ═══ */}
      <div className="flex gap-2">
        <button
          onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-2 rounded-[1rem] border border-[var(--border-soft)] bg-[var(--surface-light)] py-2.5 text-[12px] font-bold text-[var(--fg-base)] transition-all active:scale-[0.98] hover:border-[var(--accent)]/30 hover:bg-white hover:text-[var(--accent)]"
        >
          <Edit2 className="size-3.5" /> Sửa thông tin
        </button>
        <button
          onClick={onRecalculate}
          disabled={isRecalculating}
          className="flex-1 flex items-center justify-center gap-2 rounded-[1rem] border border-[var(--border-soft)] bg-[var(--surface-light)] py-2.5 text-[12px] font-bold text-[var(--fg-base)] transition-all active:scale-[0.98] hover:border-blue-500/30 hover:bg-blue-500/5 hover:text-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className={`size-3.5 ${isRecalculating ? 'animate-spin' : ''}`} />
          {isRecalculating ? "Đang đồng bộ..." : "Đồng bộ slot"}
        </button>
      </div>

      {/* ═══ Account Info Card ═══ */}
      <div className="app-card overflow-hidden border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
        <div className="border-b border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,244,0.84))] px-4 py-3">
          <h3 className="text-[12px] font-bold text-[var(--fg-muted)] uppercase tracking-wider">Thông tin tài khoản</h3>
        </div>
        <div className="p-4 space-y-3">
          <InfoRow label="Email" value={account.email} copyable onCopy={() => handleCopy(account.email, 'email')} copied={copiedId === 'email'} />
          <InfoRow label="Provider" value={providerName} />
          <InfoRow
            label="Sản phẩm"
            value={account.productIds.map(pid => productMap.get(pid) || pid).join(', ')}
          />
          {decryptedPassword && (
            <div className="flex justify-between items-center">
              <span className="text-[12px] text-[var(--fg-muted)] font-medium">Mật khẩu</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[12px] font-bold text-[var(--fg-base)] max-w-[180px] truncate">
                  {showPassword ? decryptedPassword : "••••••••"}
                </span>
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 rounded hover:bg-gray-100 transition-colors"
                  title={showPassword ? "Ẩn" : "Hiện"}
                >
                  {showPassword ? <EyeOff className="size-3 text-[var(--fg-muted)]" /> : <Eye className="size-3 text-[var(--fg-muted)]" />}
                </button>
                <button
                  onClick={() => handleCopy(decryptedPassword, 'pwd')}
                  className="p-1 rounded hover:bg-gray-100 transition-colors"
                  title="Sao chép"
                >
                  {copiedId === 'pwd' ? <Check className="size-3 text-green-500" /> : <Copy className="size-3 text-[var(--fg-muted)]" />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ Slots & Expiry Card ═══ */}
      <div className="app-card overflow-hidden border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
        <div className="border-b border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,244,0.84))] px-4 py-3">
          <h3 className="text-[12px] font-bold text-[var(--fg-muted)] uppercase tracking-wider flex items-center gap-2">
            <Users className="size-3.5 text-[var(--accent)]" />
            Sức chứa & Hết hạn
          </h3>
        </div>
        <div className="p-4 space-y-4">
          {/* Slots */}
          <div>
            <div className="flex justify-between items-end mb-2">
              <div>
                <span className="text-3xl font-black text-[var(--fg-base)]">{account.usedSlots}</span>
                <span className="text-lg text-[var(--fg-muted)] font-medium"> / {account.maxSlots}</span>
              </div>
              <div className="text-right">
                <span className={`text-[13px] font-bold ${isFull ? 'text-red-500' : slotsPercent > 80 ? 'text-amber-500' : 'text-[var(--accent)]'}`}>
                  {slotsPercent}% Used
                </span>
                <div className={`text-[11px] font-medium ${freeSlots === 0 ? 'text-red-500' : 'text-blue-500'}`}>
                  Trống: {freeSlots} slot
                </div>
              </div>
            </div>
            <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isFull ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]'
                    : slotsPercent > 80 ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                    : 'bg-[var(--accent)] shadow-[0_0_8px_rgba(85,202,2,0.4)]'
                }`}
                style={{ width: `${Math.min(100, slotsPercent)}%` }}
              />
            </div>
          </div>

          {/* Expiry */}
          <div className={`flex items-center justify-between px-3 py-2.5 rounded-lg border ${
            isExpired ? 'bg-red-50 border-red-200'
              : isExpiringSoon ? 'bg-amber-50 border-amber-200'
              : 'bg-green-50 border-green-200'
          }`}>
            <div className="flex items-center gap-2">
              <Calendar className={`size-4 ${isExpired ? 'text-red-500' : isExpiringSoon ? 'text-amber-500' : 'text-green-500'}`} />
              <span className="text-[12px] font-medium text-[var(--fg-muted)]">Hết hạn</span>
            </div>
            <div className="text-right">
              <div className="text-[13px] font-bold text-[var(--fg-base)]">{formatDateLabel(account.expiresAt)}</div>
              <div className={`text-[10px] font-bold ${
                isExpired ? 'text-red-500' : isExpiringSoon ? 'text-amber-500' : 'text-green-600'
              }`}>
                {isExpired ? (
                  <span className="flex items-center gap-1"><AlertTriangle className="size-3" /> ĐÃ HẾT HẠN ({Math.abs(daysUntilExpiry)} ngày trước)</span>
                ) : isExpiringSoon ? (
                  <span className="flex items-center gap-1"><AlertTriangle className="size-3" /> Còn {daysUntilExpiry} ngày</span>
                ) : (
                  <span>Còn {daysUntilExpiry} ngày</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Credentials Card ═══ */}
      <div className="app-card overflow-hidden border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
        <div className="border-b border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,244,0.84))] px-4 py-3">
          <h3 className="text-[12px] font-bold text-[var(--fg-muted)] uppercase tracking-wider flex items-center gap-2">
            <Key className="size-3.5 text-[var(--accent)]" />
            Thông tin đăng nhập ({loadingCreds ? '...' : decryptedCreds.length})
          </h3>
        </div>
        <div className="p-3">
          {loadingCreds ? (
            <div className="flex items-center justify-center py-6 text-[var(--fg-muted)]">
              <RefreshCw className="size-4 animate-spin mr-2" />
              <span className="text-[12px]">Đang giải mã...</span>
            </div>
          ) : decryptedCreds.length === 0 ? (
            <div className="py-4 text-center">
              <p className="text-[12px] text-[var(--fg-muted)] italic">Chưa có thông tin đăng nhập kho</p>
              <button
                onClick={onEdit}
                className="mt-2 text-[11px] font-bold text-[var(--accent)] hover:underline"
              >
                + Thêm ngay
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {decryptedCreds.map(cred => {
                const meta = CRED_META[cred.type] || CRED_META.other;
                const Icon = meta.icon;
                const isSensitive = meta.sensitive;
                const isRevealed = visibleSensitive.has(cred.id);
                const displayValue = isSensitive && !isRevealed ? "••••••••" : cred.value;
                const isUrl = cred.type === 'link_join' && cred.value?.startsWith('http');

                return (
                  <div
                    key={cred.id}
                    className="flex items-center gap-2.5 p-2.5 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-app)]/50 group hover:border-[var(--accent)]/30 transition-colors"
                  >
                    <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${
                      cred.type === 'link_join' ? 'bg-blue-100'
                        : cred.type === 'duolingo_id' ? 'bg-green-100'
                        : cred.type === '2fa' ? 'bg-amber-100'
                        : cred.type === '2fa_backup' ? 'bg-red-100'
                        : 'bg-gray-100'
                    }`}>
                      <Icon className={`size-4 ${meta.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider block">
                        {cred.label || meta.label}
                      </span>
                      {isUrl ? (
                        <a
                          href={cred.value}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[12px] font-mono font-medium text-blue-600 hover:underline truncate block max-w-[200px]"
                        >
                          {cred.value}
                        </a>
                      ) : (
                        <span className="text-[12px] font-mono font-medium text-[var(--fg-base)] truncate block max-w-[200px]">
                          {displayValue}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {isSensitive && (
                        <button
                          onClick={() => toggleSensitive(cred.id)}
                          className="p-1 rounded hover:bg-gray-100 transition-colors"
                          title={isRevealed ? "Ẩn" : "Hiện"}
                        >
                          {isRevealed ? <EyeOff className="size-3 text-[var(--fg-muted)]" /> : <Eye className="size-3 text-[var(--fg-muted)]" />}
                        </button>
                      )}
                      <button
                        onClick={() => handleCopy(cred.value, cred.id)}
                        className="p-1 rounded hover:bg-gray-100 transition-colors"
                        title="Sao chép"
                      >
                        {copiedId === cred.id ? <Check className="size-3 text-green-500" /> : <Copy className="size-3 text-[var(--fg-muted)]" />}
                      </button>
                      {isUrl && (
                        <a
                          href={cred.value}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 rounded hover:bg-gray-100 transition-colors"
                          title="Mở liên kết"
                        >
                          <ExternalLink className="size-3 text-[var(--fg-muted)]" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ═══ Duolingo Quick Info Banner ═══ */}
      {duolingoInfo && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-green-200 bg-green-50/60">
          <span className="text-lg">🦉</span>
          <div className="flex-1 min-w-0">
            <span className="text-[11px] font-bold text-green-700 uppercase tracking-wider block">Duolingo Account</span>
            <span className="text-[12px] font-mono font-medium text-green-800 truncate block">{duolingoInfo}</span>
          </div>
          {inviteLink && (
            <button
              onClick={() => handleCopy(inviteLink, 'invite')}
              className="text-[10px] font-bold text-green-600 bg-green-100 px-2.5 py-1.5 rounded-lg hover:bg-green-200 transition-colors flex items-center gap-1 shrink-0"
            >
              {copiedId === 'invite' ? <Check className="size-3" /> : <Copy className="size-3" />}
              Invite Link
            </button>
          )}
        </div>
      )}

      {/* ═══ Cost info (if available) ═══ */}
      {(account.purchaseCostVnd || account.purchaseDate || account.purchaseSource) && (
      <div className="app-card overflow-hidden border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
        <div className="border-b border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,244,0.84))] px-4 py-3">
            <h3 className="text-[12px] font-bold text-[var(--fg-muted)] uppercase tracking-wider">Chi phí mua hàng</h3>
          </div>
          <div className="p-4 space-y-2">
            {account.purchaseCostVnd != null && account.purchaseCostVnd > 0 && (
              <InfoRow label="Giá mua" value={formatMoney(account.purchaseCostVnd)} />
            )}
            {account.purchaseDate && <InfoRow label="Ngày mua" value={formatDateLabel(account.purchaseDate)} /> }
            {account.purchaseSource && <InfoRow label="Nguồn mua" value={account.purchaseSource} />}
          </div>
        </div>
      )}

      {/* ═══ Children: Connections + Activity ═══ */}
      {children}
    </div>
  );
}

// Helper row component
function InfoRow({
  label,
  value,
  copyable,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  copyable?: boolean;
  onCopy?: () => void;
  copied?: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[12px] text-[var(--fg-muted)] font-medium">{label}</span>
      <div className="flex items-center gap-1.5 max-w-[60%]">
        <span className="font-bold text-[12px] text-[var(--fg-base)] truncate">{value}</span>
        {copyable && onCopy && (
          <button
            onClick={onCopy}
            className="p-0.5 rounded hover:bg-gray-100 transition-colors shrink-0"
            title="Sao chép"
          >
            {copied ? <Check className="size-3 text-green-500" /> : <Copy className="size-3 text-[var(--fg-muted)]" />}
          </button>
        )}
      </div>
    </div>
  );
}
