"use client";

import { useState } from "react";
import { Users, RefreshCw, Copy, Check, User, Crown, Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { appToast } from "@/shared/ui/app-toast";
import { FadeIn } from "@/shared/ui/animations";

interface FamilyMember {
  id: number;
  username: string;
  name: string;
  isOwner: boolean;
  hasPlus?: boolean;
}

interface FamilyData {
  isFamilyPlan: boolean;
  maxMembers: number;
  members: FamilyMember[];
  expiresAt: string | null;
  planType: string | null;
  inviteToken: string | null;
}

interface DuolingoFamilyPanelProps {
  sourceAccountId: string;
  /** Initial family data already fetched from auto-fill, if any */
  initialData?: FamilyData | null;
}

export function DuolingoFamilyPanel({ sourceAccountId, initialData }: DuolingoFamilyPanelProps) {
  const [familyData, setFamilyData] = useState<FamilyData | null>(initialData ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      // Decrypt password first
      const decRes = await fetch(`/api/source-accounts/${sourceAccountId}/decrypt`);
      if (!decRes.ok) throw new Error("Không thể giải mã mật khẩu");
      const decData = await decRes.json();

      const email = decData.data?.email;
      const password = decData.data?.password;
      if (!email || !password) throw new Error("Thiếu email hoặc mật khẩu");

      // Login + get family
      const loginRes = await fetch("/api/proxy/duolingo-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: email, password }),
      });

      if (!loginRes.ok) {
        const err = await loginRes.json();
        throw new Error(err.error ?? "Login Duolingo thất bại");
      }

      const result = await loginRes.json();

      setFamilyData({
        isFamilyPlan: result.subscription?.isFamilyPlan ?? false,
        maxMembers: result.subscription?.maxFamilyMembers ?? 6,
        members: result.familyMembers ?? [],
        expiresAt: result.subscription?.expiresAt ?? null,
        planType: result.subscription?.planType ?? null,
        inviteToken: result.inviteToken ?? null,
      });

      if (result.familyMembers?.length > 0) {
        appToast.success(`🦉 Đã tải ${result.familyMembers.length} thành viên family`);
      } else if (result.subscription?.isFamilyPlan) {
        appToast.info("🦉 Family Plan nhưng không tìm thấy danh sách thành viên từ API");
      } else {
        appToast.info("🦉 Tài khoản này không phải Family Plan");
      }
    } catch (err) {
      appToast.error(err instanceof Error ? err.message : "Lỗi khi tải family data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyAll = () => {
    if (!familyData?.members.length) return;
    const text = familyData.members
      .map((m) => `${m.username || m.id}${m.name ? ` (${m.name})` : ""}${m.isOwner ? " [Owner]" : ""}`)
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    appToast.success("Đã sao chép danh sách!");
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleCopyMember = (member: FamilyMember) => {
    navigator.clipboard.writeText(member.username || String(member.id));
    setCopiedId(member.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyToken = () => {
    if (!familyData?.inviteToken) return;
    navigator.clipboard.writeText(familyData.inviteToken);
    setCopiedToken(true);
    appToast.success("Đã sao chép Invite Token!");
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const usedSlots = familyData?.members.length ?? 0;
  const maxSlots = familyData?.maxMembers ?? 6;
  const freeSlots = Math.max(0, maxSlots - usedSlots);

  // Empty state — no data yet
  if (!familyData) {
    return (
      <div className="text-center py-8 space-y-4">
        <div className="size-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
          <Users className="size-8 text-green-500" />
        </div>
        <div>
          <p className="text-[14px] font-bold text-[var(--fg-base)]">Duolingo Family Plan</p>
          <p className="text-[12px] text-[var(--fg-muted)] mt-1">
            Đồng bộ để xem thành viên trong Family Plan
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white text-[13px] font-bold rounded-xl transition-colors disabled:opacity-50 active:scale-95"
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          {isLoading ? "Đang đồng bộ..." : "🦉 Đồng bộ từ Duolingo"}
        </button>
      </div>
    );
  }

  // Not a family plan
  if (!familyData.isFamilyPlan && familyData.members.length === 0) {
    return (
      <div className="text-center py-8 space-y-3">
        <div className="size-14 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="size-7 text-amber-500" />
        </div>
        <p className="text-[13px] font-bold text-[var(--fg-base)]">Không phải Family Plan</p>
        <p className="text-[12px] text-[var(--fg-muted)]">
          Tài khoản này dùng gói: <strong>{familyData.planType || "Individual"}</strong>
        </p>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="text-[11px] text-[var(--accent)] hover:underline font-bold inline-flex items-center gap-1"
        >
          <RefreshCw className={`size-3 ${isLoading ? "animate-spin" : ""}`} />
          Kiểm tra lại
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header summary */}
      <div className="p-3 bg-green-50 rounded-xl border border-green-200">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-green-600" />
            <span className="text-[12px] font-bold text-green-700 uppercase tracking-wider">
              Family Plan
            </span>
            {familyData.planType && (
              <span className="text-[10px] font-medium text-green-600/70">
                ({familyData.planType})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="text-[10px] font-bold text-green-600 hover:text-green-700 flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-green-100 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`size-3 ${isLoading ? "animate-spin" : ""}`} />
              Đồng bộ
            </button>
            <span className="text-[12px] font-black text-green-700">
              {usedSlots} / {maxSlots}
            </span>
          </div>
        </div>

        {/* Slot bar */}
        <div className="w-full h-2 bg-green-200/50 rounded-full overflow-hidden mb-2">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              freeSlots === 0 ? "bg-red-500" : freeSlots <= 2 ? "bg-amber-500" : "bg-green-500"
            }`}
            style={{ width: `${(usedSlots / maxSlots) * 100}%` }}
          />
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px]">
          <span className="flex items-center gap-1">
            <span className="inline-block size-2 rounded-full bg-green-500" />
            <span className="text-green-700">
              Đã join: <strong>{usedSlots}</strong>
            </span>
          </span>
          <span className="flex items-center gap-1">
            <span className={`inline-block size-2 rounded-full ${freeSlots === 0 ? "bg-red-500" : freeSlots <= 2 ? "bg-amber-500" : "bg-gray-300"}`} />
            <span className={`${freeSlots === 0 ? "text-red-600 font-bold" : freeSlots <= 2 ? "text-amber-600 font-bold" : "text-green-700"}`}>
              Còn trống: <strong>{freeSlots}</strong>
            </span>
          </span>
        </div>
      </div>

      {/* Invite Token */}
      {familyData.inviteToken && (
        <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider shrink-0">
                🎟️ Invite Token
              </span>
              <code className="text-[13px] font-mono font-black text-blue-800 truncate">
                {familyData.inviteToken}
              </code>
            </div>
            <button
              onClick={handleCopyToken}
              className="size-8 flex items-center justify-center rounded-lg hover:bg-blue-100 transition-colors shrink-0 ml-2"
              title="Sao chép Token"
            >
              {copiedToken ? <Check className="size-4 text-green-500" /> : <Copy className="size-4 text-blue-500" />}
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <h4 className="text-[12px] font-bold text-[var(--fg-muted)] uppercase tracking-wider flex items-center gap-2">
          <User className="size-4" />
          Thành viên ({familyData.members.length})
        </h4>
        {familyData.members.length > 0 && (
          <button
            onClick={handleCopyAll}
            className="text-[11px] font-bold text-[var(--accent)] hover:underline flex items-center gap-1"
          >
            {copiedAll ? <Check className="size-3 text-green-500" /> : <Copy className="size-3" />}
            {copiedAll ? "Đã sao chép!" : "Sao chép tất cả"}
          </button>
        )}
      </div>

      {/* Members list */}
      {familyData.members.length === 0 ? (
        <p className="text-[12px] text-[var(--fg-muted)] text-center py-4 bg-gray-50 rounded-xl border border-dashed border-[var(--border-soft)]">
          Không tìm thấy thành viên nào
        </p>
      ) : (
        <div className="space-y-2">
          {familyData.members.map((member) => (
            <FadeIn
              key={member.id}
              className="p-3 bg-white rounded-xl border border-[var(--border-soft)] shadow-sm flex items-center justify-between gap-3 group hover:border-green-400/40 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {/* Avatar */}
                <div className={`size-9 rounded-full flex items-center justify-center text-white shrink-0 ${
                  member.isOwner
                    ? "bg-gradient-to-br from-amber-400 to-orange-500"
                    : member.hasPlus
                    ? "bg-gradient-to-br from-green-400 to-teal-500"
                    : "bg-gradient-to-br from-gray-400 to-gray-500"
                }`}>
                  {member.isOwner ? (
                    <Crown className="size-4" />
                  ) : (
                    <User className="size-4" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[13px] text-[var(--fg-base)] truncate">
                      {member.username || `User #${member.id}`}
                    </span>
                    {member.isOwner && (
                      <span className="text-[9px] font-bold bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded uppercase">
                        Owner
                      </span>
                    )}
                    {member.hasPlus && !member.isOwner && (
                      <span className="text-[9px] font-bold bg-green-100 text-green-600 px-1.5 py-0.5 rounded">
                        ⭐ Plus
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[var(--fg-muted)] flex items-center gap-2">
                    <span>ID: {member.id}</span>
                    {member.name && (
                      <>
                        <span>•</span>
                        <span className="truncate">{member.name}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                {member.username && (
                  <a
                    href={`https://www.duolingo.com/profile/${member.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="size-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100"
                    title={`Xem profile ${member.username}`}
                  >
                    <ExternalLink className="size-3.5 text-[var(--fg-muted)]" />
                  </a>
                )}
                <button
                  onClick={() => handleCopyMember(member)}
                  className="size-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors shrink-0"
                  title={`Sao chép ${member.username || member.id}`}
                >
                  {copiedId === member.id ? (
                    <Check className="size-4 text-green-500" />
                  ) : (
                    <Copy className="size-4 text-[var(--fg-muted)]" />
                  )}
                </button>
              </div>
            </FadeIn>
          ))}
        </div>
      )}
    </div>
  );
}
