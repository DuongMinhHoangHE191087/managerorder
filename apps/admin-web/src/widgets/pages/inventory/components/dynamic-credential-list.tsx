"use client";

import * as React from "react";
import { Plus, Trash2, Eye, EyeOff, Link2, Shield, Key, MoreHorizontal, Loader2, Zap, LogIn, Users, Crown, User, Copy, Check, ExternalLink } from "lucide-react";
import { appToast } from "@/shared/ui/app-toast";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import type { WarehouseCredential, WarehouseCredentialType } from "@/lib/domain/types";
import { formatNumber } from "@/lib/utils";

export interface DuolingoAutoFillResult {
  userId: number;
  username: string;
  name: string;
  hasPlus: boolean;
  streak: number;
  totalXp: number;
  profileUrl: string;
  subscription: {
    isActive: boolean;
    planType: string | null;
    renewDate: string | null;
    expiresAt: string | null;
    isFamilyPlan: boolean;
    maxFamilyMembers: number;
  };
  familyMembers: Array<{
    id: number;
    username: string;
    name: string;
    isOwner: boolean;
    hasPlus?: boolean;
  }>;
  inviteToken?: string | null;
}

interface DynamicCredentialListProps {
  credentials: WarehouseCredential[];
  onChange: (credentials: WarehouseCredential[]) => void;
  baseUsername?: string;
  basePassword?: string;
  suggestDuolingo?: boolean;
  onAutoFillResult?: (result: DuolingoAutoFillResult) => void;
}

const CREDENTIAL_TYPES: {
  value: WarehouseCredentialType;
  label: string;
  icon: React.FC<{ className?: string }>;
  placeholder: string;
  sensitive?: boolean;
}[] = [
  { value: "link_join", label: "Link Tham Gia", icon: Link2, placeholder: "https://..." },
  { value: "2fa", label: "Mã 2FA", icon: Shield, placeholder: "Mã 2FA hoặc secret key...", sensitive: true },
  { value: "2fa_backup", label: "Mã Dự Phòng 2FA", icon: Key, placeholder: "Mã backup 2FA...", sensitive: true },
  { value: "duolingo_id", label: "Duolingo ID", icon: Zap, placeholder: "Auto-fetch hoặc nhập tay..." },
  { value: "other", label: "Khác", icon: MoreHorizontal, placeholder: "Giá trị..." },
];

export function DynamicCredentialList({ credentials, onChange, baseUsername, basePassword, suggestDuolingo, onAutoFillResult }: DynamicCredentialListProps) {
  const [visibleIds, setVisibleIds] = React.useState<Set<string>>(new Set());
  const [autoFillLoading, setAutoFillLoading] = React.useState(false);
  const [loginResult, setLoginResult] = React.useState<DuolingoAutoFillResult | null>(null);
  const [copiedToken, setCopiedToken] = React.useState(false);
  const [copiedMemberId, setCopiedMemberId] = React.useState<number | null>(null);

  const addCredential = (type: WarehouseCredentialType = "link_join") => {
    onChange([
      ...credentials,
      { id: crypto.randomUUID(), type, value: "" },
    ]);
  };

  const updateCredential = (id: string, updates: Partial<WarehouseCredential>) => {
    onChange(credentials.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const removeCredential = (id: string) => {
    onChange(credentials.filter((c) => c.id !== id));
    setVisibleIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
  };

  const toggleVisibility = (id: string) => {
    setVisibleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Login Duolingo: authenticate → fill ID, link_join, show family panel
  const handleDuolingoLogin = async () => {
    if (!baseUsername?.trim() || !basePassword?.trim()) {
      appToast.error("Vui lòng nhập Email/Username và Mật khẩu đăng nhập kho ở trên trước!");
      return;
    }
    setAutoFillLoading(true);
    setLoginResult(null);
    try {
      const res = await fetch("/api/proxy/duolingo-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: baseUsername.trim(), password: basePassword.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        appToast.error(data.error || "Đăng nhập Duolingo thất bại");
        return;
      }

      // Save result for inline display
      setLoginResult(data);

      // Build new credentials from result
      const newCreds = [...credentials];

      // Fill/add duolingo_id with Username + ID format
      const duoIdValue = `Username: ${data.username} | DuolingoID: ${data.userId}`;
      const existingId = newCreds.find(c => c.type === "duolingo_id");
      if (existingId) {
        existingId.value = duoIdValue;
      } else {
        newCreds.push({ id: crypto.randomUUID(), type: "duolingo_id", value: duoIdValue });
      }

      // Fill/add link_join — use invite URL (family) or profile URL (individual)
      const inviteToken = data.inviteToken;
      const linkValue = inviteToken
        ? `https://invite.duolingo.com/family-plan/${inviteToken}`
        : data.profileUrl;
      if (linkValue) {
        const existingLink = newCreds.find(c => c.type === "link_join");
        if (existingLink) {
          existingLink.value = linkValue;
        } else {
          newCreds.push({ id: crypto.randomUUID(), type: "link_join", value: linkValue });
        }
      }

      onChange(newCreds);
      onAutoFillResult?.(data);

      const parts = [`Username: ${data.username}`, `ID: ${data.userId}`];
      if (data.hasPlus) parts.push("⭐ Plus");
      if (data.subscription?.isFamilyPlan) {
        const memberCount = data.familyMembers?.length ?? 0;
        const maxMembers = data.subscription?.maxFamilyMembers ?? 6;
        const freeCount = Math.max(0, maxMembers - memberCount);
        parts.push(`👨‍👩‍👧‍👦 Family ${memberCount}/${maxMembers} (trống: ${freeCount})`);
      }
      appToast.success(`🦉 ${parts.join(" • ")}`);
    } catch {
      appToast.error("Lỗi kết nối khi đăng nhập Duolingo");
    } finally {
      setAutoFillLoading(false);
    }
  };

  const handleCopyInviteToken = () => {
    if (loginResult?.inviteToken) {
      navigator.clipboard.writeText(loginResult.inviteToken);
      setCopiedToken(true);
      appToast.success("Đã sao chép Invite Token!");
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  const handleCopyMember = (member: DuolingoAutoFillResult["familyMembers"][0]) => {
    navigator.clipboard.writeText(member.username || String(member.id));
    setCopiedMemberId(member.id);
    setTimeout(() => setCopiedMemberId(null), 2000);
  };

  const canAutoFill = suggestDuolingo && !!baseUsername?.trim() && !!basePassword?.trim();

  const usedSlots = loginResult?.familyMembers?.length ?? 0;
  const maxSlots = loginResult?.subscription?.maxFamilyMembers ?? 6;
  const freeSlots = Math.max(0, maxSlots - usedSlots);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border-soft)] pb-2">
        <div>
          <h3 className="text-[13px] font-bold text-[var(--fg-base)] flex items-center gap-2">
            <Key className="size-4 text-[var(--accent)]" />
            Thông tin đăng nhập kho
          </h3>
          <p className="text-[11px] text-[var(--fg-muted)] mt-0.5">
            Link Join, 2FA, mã dự phòng...
          </p>
        </div>
        <div className="flex items-center gap-2">
          {suggestDuolingo && !credentials.some(c => c.type === "duolingo_id") && (
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => addCredential("duolingo_id")}
              className="h-8 gap-1.5 bg-green-500/10 text-green-500 hover:bg-green-500/20 hover:text-green-600 border-green-500/20"
            >
              <Zap className="size-3.5" /> Thêm Duolingo ID
            </Button>
          )}
          <CredentialAddDropdown onAdd={addCredential} />
        </div>
      </div>

      {/* Duolingo Login Button */}
      {canAutoFill && (
        <button
          type="button"
          onClick={handleDuolingoLogin}
          disabled={autoFillLoading}
          className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border-2 border-dashed border-green-500/40 bg-gradient-to-r from-green-500/5 to-emerald-500/5 hover:from-green-500/10 hover:to-emerald-500/10 hover:border-green-500/60 text-green-600 text-[13px] font-bold transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed group"
        >
          {autoFillLoading ? (
            <><Loader2 className="size-4 animate-spin" /> Đang đăng nhập Duolingo...</>
          ) : (
            <><LogIn className="size-4 group-hover:scale-110 transition-transform" /> 🦉 Đăng nhập Duolingo — Lấy ID, Username, Family</>
          )}
        </button>
      )}

      {/* ═══ Login Result Panel ═══ */}
      {loginResult && (
        <div className="rounded-xl border border-green-300 bg-green-50/50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
          {/* Account info header */}
          <div className="p-3 bg-green-100/50 border-b border-green-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-white font-bold text-[14px] shrink-0">
                  🦉
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-[14px] text-green-800">
                      {loginResult.username}
                    </span>
                    {loginResult.hasPlus && (
                      <span className="text-[9px] font-bold bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                        ⭐ Plus
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-green-600 flex items-center gap-2">
                    <span>ID: <strong>{loginResult.userId}</strong></span>
                    <span>•</span>
                    <span>XP: {formatNumber(loginResult.totalXp)}</span>
                    <span>•</span>
                    <span>🔥 {loginResult.streak}</span>
                  </div>
                </div>
              </div>
              <a
                href={loginResult.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-green-600 hover:text-green-700 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-green-200/50 transition-colors"
              >
                <ExternalLink className="size-3" /> Profile
              </a>
            </div>
          </div>

          {/* Family Plan Section */}
          {loginResult.subscription?.isFamilyPlan && (
            <div className="p-3 space-y-3">
              {/* Slot bar */}
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-green-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="size-3.5" /> Family Plan
                </span>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="text-green-700">
                    Đã join: <strong>{usedSlots}</strong>
                  </span>
                  <span className={`font-bold ${freeSlots > 0 ? "text-blue-600" : "text-red-500"}`}>
                    Còn trống: <strong>{freeSlots}</strong>
                  </span>
                  <span className="text-green-600 font-black">
                    {usedSlots}/{maxSlots}
                  </span>
                </div>
              </div>
              <div className="w-full h-2 bg-green-200/50 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    freeSlots === 0 ? "bg-red-500" : freeSlots <= 2 ? "bg-amber-500" : "bg-green-500"
                  }`}
                  style={{ width: `${(usedSlots / maxSlots) * 100}%` }}
                />
              </div>

              {/* Invite Token */}
              {loginResult.inviteToken && (
                <div className="flex items-center gap-2 p-2 bg-white/50 rounded-lg border border-green-200/50">
                  <span className="text-[10px] font-bold text-green-600 uppercase shrink-0">
                    Invite Token:
                  </span>
                  <code className="text-[12px] font-mono font-bold text-green-800 flex-1 truncate">
                    {loginResult.inviteToken}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyInviteToken}
                    className="size-7 flex items-center justify-center rounded-md hover:bg-green-100 transition-colors shrink-0"
                    title="Sao chép Invite Token"
                  >
                    {copiedToken ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5 text-green-600" />}
                  </button>
                </div>
              )}

              {/* Members list */}
              {loginResult.familyMembers.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-green-600/70 uppercase tracking-wider">
                    Thành viên ({loginResult.familyMembers.length})
                  </span>
                  <div className="grid gap-1.5">
                    {loginResult.familyMembers.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center gap-2.5 p-2 bg-white rounded-lg border border-[var(--border-soft)] group hover:border-green-400/40 transition-colors"
                      >
                        <div className={`size-7 rounded-full flex items-center justify-center text-white text-[10px] shrink-0 ${
                          member.isOwner
                            ? "bg-gradient-to-br from-amber-400 to-orange-500"
                            : member.hasPlus
                            ? "bg-gradient-to-br from-green-400 to-teal-500"
                            : "bg-gradient-to-br from-gray-400 to-gray-500"
                        }`}>
                          {member.isOwner ? <Crown className="size-3" /> : <User className="size-3" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-[12px] text-[var(--fg-base)] truncate">
                              {member.username || `User #${member.id}`}
                            </span>
                            {member.isOwner && (
                              <span className="text-[8px] font-bold bg-amber-100 text-amber-600 px-1 py-px rounded uppercase">Owner</span>
                            )}
                            {member.hasPlus && !member.isOwner && (
                              <span className="text-[8px] font-bold bg-green-100 text-green-600 px-1 py-px rounded">⭐</span>
                            )}
                          </div>
                          <span className="text-[10px] text-[var(--fg-muted)]">
                            ID: {member.id}{member.name ? ` • ${member.name}` : ""}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyMember(member)}
                          className="size-6 flex items-center justify-center rounded hover:bg-gray-100 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                          title={`Sao chép ${member.username || member.id}`}
                        >
                          {copiedMemberId === member.id
                            ? <Check className="size-3 text-green-500" />
                            : <Copy className="size-3 text-[var(--fg-muted)]" />
                          }
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Non-family — just show account info */}
          {!loginResult.subscription?.isFamilyPlan && (
            <div className="p-3 text-center">
              <span className="text-[12px] text-[var(--fg-muted)]">
                Gói: <strong>{loginResult.subscription?.planType || "Individual"}</strong>
                {loginResult.subscription?.isActive && " • ✅ Active"}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Credential rows */}
      <div className="space-y-2">
        {credentials.length === 0 && (
          <p className="text-[12px] text-[var(--fg-muted)] italic py-2 text-center">
            Chưa có thông tin đăng nhập. Nhấn + để thêm.
          </p>
        )}
        {credentials.map((cred) => (
          <CredentialRow
            key={cred.id}
            cred={cred}
            visibleIds={visibleIds}
            baseUsername={baseUsername}
            basePassword={basePassword}
            updateCredential={updateCredential}
            removeCredential={removeCredential}
            toggleVisibility={toggleVisibility}
          />
        ))}
      </div>
    </div>
  );
}

// ── Single row component ───────────────────────────────────────────
function CredentialRow({
  cred, visibleIds, baseUsername: _baseUsername, basePassword: _basePassword, updateCredential, removeCredential, toggleVisibility
}: {
  cred: WarehouseCredential;
  visibleIds: Set<string>;
  baseUsername?: string;
  basePassword?: string;
  updateCredential: (id: string, updates: Partial<WarehouseCredential>) => void;
  removeCredential: (id: string) => void;
  toggleVisibility: (id: string) => void;
}) {
  const [loading, setLoading] = React.useState(false);

  const typeInfo = CREDENTIAL_TYPES.find((t) => t.value === cred.type) ?? CREDENTIAL_TYPES[0];
  const Icon = typeInfo.icon;
  const isSensitive = typeInfo.sensitive;
  const isVisible = visibleIds.has(cred.id);
  const isDuolingoId = cred.type === "duolingo_id";

  const handleFetchDuolingoId = async () => {
    // Only use value from this input field — strip leading @ if present
    const raw = cred.value?.trim() ?? "";
    let usernameToLookup = raw.startsWith("@") ? raw.slice(1) : raw;

    // If value already contains "DuolingoID:" format, extract just username
    if (usernameToLookup.includes("Username:")) {
      const match = usernameToLookup.match(/Username:\s*(\S+)/);
      if (match) usernameToLookup = match[1];
    }

    if (!usernameToLookup || /^\d+$/.test(usernameToLookup)) {
      appToast.error("Nhập username (hoặc @username) vào ô để lấy ID!");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/proxy/duolingo-id?username=${encodeURIComponent(usernameToLookup)}`);
      const data = await res.json() as { id?: number; username?: string; method?: string; error?: string };
      if (data.id) {
        const resolvedUsername = data.username ?? usernameToLookup;
        updateCredential(cred.id, { value: `Username: ${resolvedUsername} | DuolingoID: ${data.id}` });
        appToast.success(`Lấy ID thành công — Username: ${resolvedUsername} | DuolingoID: ${data.id}`);
      } else {
        appToast.error(data.error || `Không tìm thấy ID cho "${usernameToLookup}"`);
      }
    } catch {
      appToast.error("Lỗi kết nối khi lấy Duolingo ID");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 p-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-light)]">
      <div className="flex gap-2 items-center">
        {/* Type selector */}
        <Select
          className="h-9 !w-[160px] shrink-0 rounded-lg text-[12px]"
          value={cred.type}
          onChange={(e) => updateCredential(cred.id, { type: e.target.value as WarehouseCredentialType })}
        >
          {CREDENTIAL_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>

        {/* Custom label for "other" */}
        {cred.type === "other" && (
          <Input
            value={cred.label ?? ""}
            onChange={(e) => updateCredential(cred.id, { label: e.target.value })}
            placeholder="Tên trường..."
            className="h-9 text-[12px] w-28 shrink-0"
          />
        )}

        {/* Value input */}
        <div className="relative flex-1 flex gap-2">
          <div className="relative flex-1">
            <Icon className={`absolute left-3 top-1/2 -translate-y-1/2 size-3.5 ${isDuolingoId ? "text-green-500" : "text-[var(--fg-muted)]"}`} />
            <Input
              type={isSensitive && !isVisible ? "password" : "text"}
              value={cred.value}
              onChange={(e) => updateCredential(cred.id, { value: e.target.value })}
              placeholder={isDuolingoId ? "Nhập username để lấy ID hoặc nhập ID tay..." : typeInfo.placeholder}
              className={`h-9 pl-8 pr-9 text-[12px] font-mono ${isDuolingoId ? "border-green-500/30 focus:ring-green-500" : ""}`}
            />
            {isSensitive && (
              <button
                type="button"
                onClick={() => toggleVisibility(cred.id)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--fg-muted)] hover:text-[var(--fg-base)] transition-colors"
              >
                {isVisible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
            )}
          </div>
          {isDuolingoId && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleFetchDuolingoId}
              disabled={loading}
              className="h-9 whitespace-nowrap px-3 text-green-600 bg-green-500/10 hover:bg-green-500/20 border-green-500/20"
            >
              {loading ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <Zap className="size-3.5 mr-1.5" />}
              Lấy ID
            </Button>
          )}
        </div>

        {/* Delete button */}
        <button
          type="button"
          onClick={() => removeCredential(cred.id)}
          className="h-9 w-9 flex items-center justify-center rounded-lg border border-[var(--border-soft)] text-[var(--fg-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors shrink-0"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Dropdown add button ────────────────────────────────────────────
function CredentialAddDropdown({ onAdd }: { onAdd: (type: WarehouseCredentialType) => void }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <Button
        variant="secondary"
        size="sm"
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="h-8 gap-1.5 text-[var(--accent)] hover:text-[var(--accent-strong)]"
      >
        <Plus className="size-3.5" />
        Thêm trường
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[170px] bg-[var(--surface-light)] border border-[var(--border-soft)] rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          {CREDENTIAL_TYPES.map((t) => {
            const TypeIcon = t.icon;
            return (
              <button
                key={t.value}
                type="button"
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[12px] font-medium text-[var(--fg-base)] hover:bg-[var(--accent)]/10 hover:text-[var(--accent)] transition-colors"
                onClick={() => { onAdd(t.value); setOpen(false); }}
              >
                <TypeIcon className="size-3.5 text-[var(--accent)] shrink-0" />
                {t.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
