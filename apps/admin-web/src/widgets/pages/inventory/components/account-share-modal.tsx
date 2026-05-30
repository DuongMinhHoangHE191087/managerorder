"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity, Ban, Check, Copy, Dice6,
  ExternalLink, Eye, Link2, Lock,
  RotateCcw, ShieldCheck, Trash2, Zap,
} from "lucide-react";
import { appToast } from "@/shared/ui/app-toast";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Modal } from "@/shared/ui/modal";
import { cn } from "@/lib/utils";
import type { SourceAccount, WarehouseCredentialType } from "@/lib/domain/types";
import type { DecryptedSourceAccountCredential, DecryptedSourceAccountSecrets } from "@/widgets/pages/inventory/hooks/use-source-accounts";
import {
  useAccountShareLogs,
  useAccountShares,
  useCreateAccountShare,
  useDeleteAccountShare,
  useUpdateAccountShare,
  type AccountShareAccessLog,
  type AccountShareFieldType,
  type AccountShareLink,
} from "@/widgets/pages/inventory/hooks/use-account-shares";

interface AccountShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: Pick<SourceAccount, "id" | "email">;
  secrets?: DecryptedSourceAccountSecrets | null;
  loadingSecrets?: boolean;
  orderId?: string | null;
  orderItemId?: string | null;
  customerId?: string | null;
}

type FieldOption = {
  id: AccountShareFieldType;
  label: string;
  sensitive?: boolean;
  available: boolean;
};

type ExpiryPreset = { label: string; hours: number | null };

const EXPIRY_PRESETS: ExpiryPreset[] = [
  { label: "1h", hours: 1 },
  { label: "24h", hours: 24 },
  { label: "7 ngày", hours: 168 },
  { label: "30 ngày", hours: 720 },
  { label: "∞", hours: null },
];

const CREDENTIAL_FIELD_TYPES = new Set<WarehouseCredentialType>(["link_join", "2fa", "2fa_backup", "duolingo_id", "other"]);

function generatePasscode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function expiryFromPreset(hours: number | null): string {
  if (hours === null) return "";
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString().slice(0, 16);
}

export function AccountShareModal({
  isOpen,
  onClose,
  account,
  secrets,
  loadingSecrets,
  orderId,
  orderItemId,
  customerId,
}: AccountShareModalProps) {
  const createShare = useCreateAccountShare();
  const updateShare = useUpdateAccountShare();
  const deleteShare = useDeleteAccountShare();
  const { data: existingShares = [] } = useAccountShares(account.id);

  const [title, setTitle] = useState("");
  const [expiresAt, setExpiresAt] = useState(() => expiryFromPreset(24));
  const [selectedPreset, setSelectedPreset] = useState<number | null>(24);
  const [maxViews, setMaxViews] = useState(20);
  const [maxUnlocks, setMaxUnlocks] = useState(10);
  const [passcode, setPasscode] = useState(() => generatePasscode());
  const [allowNoPasscode, setAllowNoPasscode] = useState(false);
  const [lockToIp, setLockToIp] = useState(false);
  const [selectedFields, setSelectedFields] = useState<Set<AccountShareFieldType>>(
    () => new Set(["email", "password", "link_join", "duolingo_id", "2fa", "2fa_backup"]),
  );
  const [selectedCredentialIds, setSelectedCredentialIds] = useState<Set<string>>(() => new Set());
  const [createdShare, setCreatedShare] = useState<AccountShareLink | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [expandedLogsId, setExpandedLogsId] = useState<string | null>(null);
  const [deletingShareLink, setDeletingShareLink] = useState<AccountShareLink | null>(null);
  const [shareTotpSecret, setShareTotpSecret] = useState(false);

  const credentialTypes = useMemo(
    () => new Set((secrets?.credentials ?? []).map((c) => c.type)),
    [secrets?.credentials],
  );

  const shareableCredentials = useMemo(
    () => (secrets?.credentials ?? []).filter((c) =>
      c.shareable !== false && CREDENTIAL_FIELD_TYPES.has(c.type),
    ),
    [secrets?.credentials],
  );

  const fieldOptions: FieldOption[] = [
    { id: "email", label: "Tài khoản", available: true },
    { id: "password", label: "Mật khẩu", sensitive: true, available: Boolean(secrets?.password) },
    { id: "link_join", label: "Link invite", available: credentialTypes.has("link_join") },
    { id: "duolingo_id", label: "Duolingo ID", available: credentialTypes.has("duolingo_id") },
    { id: "2fa", label: "2FA/TOTP", sensitive: true, available: credentialTypes.has("2fa") },
    { id: "2fa_backup", label: "Backup codes", sensitive: true, available: credentialTypes.has("2fa_backup") },
    { id: "other", label: "Trường khác", available: credentialTypes.has("other") },
  ];

  const selectedContainsSensitive =
    Boolean(secrets?.password && selectedFields.has("password")) ||
    fieldOptions.some((o) => o.sensitive && selectedFields.has(o.id) && o.available);

  useEffect(() => {
    if (!isOpen) return;
    setTitle(`Thông tin ${account.email}`);
    setExpiresAt(expiryFromPreset(24));
    setSelectedPreset(24);
    setMaxViews(20);
    setMaxUnlocks(10);
    setPasscode(generatePasscode());
    setAllowNoPasscode(false);
    setLockToIp(false);
    setSelectedCredentialIds(new Set());
    setCreatedShare(null);
    setCopied(null);
    setExpandedLogsId(null);
    setShareTotpSecret(false);
  }, [account.email, isOpen]);

  useEffect(() => {
    if (selectedContainsSensitive && allowNoPasscode && !passcode) {
      setAllowNoPasscode(false);
    }
  }, [allowNoPasscode, passcode, selectedContainsSensitive]);

  const toggleField = (field: AccountShareFieldType) => {
    setSelectedFields((cur) => {
      const next = new Set(cur);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  };

  const toggleCredential = (credentialId: string) => {
    setSelectedCredentialIds((cur) => {
      const next = new Set(cur);
      if (next.has(credentialId)) next.delete(credentialId);
      else next.add(credentialId);
      return next;
    });
  };

  const handleSelectPreset = (hours: number | null) => {
    setSelectedPreset(hours);
    setExpiresAt(expiryFromPreset(hours));
  };

  const handleCreate = async () => {
    const fields = fieldOptions
      .filter((o) => o.available && selectedFields.has(o.id))
      .map((o) => o.id);
    if (fields.length === 0 && selectedCredentialIds.size === 0) {
      appToast.error("Chọn ít nhất một trường để chia sẻ");
      return;
    }
    if (!allowNoPasscode && passcode.trim().length < 4) {
      appToast.error("Nhập mã mở khóa tối thiểu 4 ký tự");
      return;
    }
    const share = await createShare.mutateAsync({
      sourceAccountId: account.id,
      orderId: orderId ?? null,
      orderItemId: orderItemId ?? null,
      customerId: customerId ?? null,
      title: title.trim() || null,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      maxViews,
      maxUnlocks,
      passcode: allowNoPasscode ? null : passcode.trim(),
      allowNoPasscode,
      lockToIp,
      exposurePolicy: {
        fields,
        credentialIds: selectedCredentialIds.size ? [...selectedCredentialIds] : undefined,
        shareTotpSecret,
      },
    });
    setCreatedShare(share);
    appToast.success("Đã tạo link chia sẻ");
  };

  const handleCopyUrl = async (share: AccountShareLink) => {
    await navigator.clipboard.writeText(share.publicUrl);
    setCopied(share.id);
    setTimeout(() => setCopied(null), 1800);
  };

  const handleToggleStatus = async (share: AccountShareLink) => {
    const status = share.status === "active" ? "disabled" : "active";
    await updateShare.mutateAsync({ id: share.id, status });
    appToast.success(status === "active" ? "Đã bật lại link" : "Đã tắt link");
  };

  const submitDeleteShare = async () => {
    if (!deletingShareLink) return;
    await deleteShare.mutateAsync(deletingShareLink);
    if (expandedLogsId === deletingShareLink.id) setExpandedLogsId(null);
    setDeletingShareLink(null);
    appToast.success("Đã thu hồi link share");
  };

  const securityLevel = selectedContainsSensitive ? "HIGH" : "STANDARD";

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Chia sẻ tài khoản"
        size="2xl"
        footer={
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--fg-muted)]">
              <ShieldCheck className="size-3.5 text-[var(--accent)]" />
              {account.email}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onClose}>Đóng</Button>
              <Button
                variant="primary"
                onClick={handleCreate}
                isLoading={createShare.isPending}
                disabled={loadingSecrets || createShare.isPending}
              >
                <Link2 className="size-4" />
                Tạo link
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-3">
          {/* Security badge */}
          <div className={cn(
            "flex items-center gap-2 rounded-xl border px-3 py-2 text-[12px] font-bold",
            securityLevel === "HIGH"
              ? "border-amber-200/60 bg-amber-50/50 text-amber-700"
              : "border-[var(--border-soft)] bg-[var(--surface-light)] text-[var(--fg-muted)]"
          )}>
            <Lock className="size-3.5 shrink-0" />
            <span>Bảo mật: <strong>{securityLevel === "HIGH" ? "CAO — chứa dữ liệu nhạy cảm" : "THƯỜNG"}</strong></span>
            {selectedContainsSensitive && !allowNoPasscode && passcode && (
              <span className="ml-auto rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-black tracking-widest text-amber-800">
                BẮT BUỘC MÃ
              </span>
            )}
          </div>

          {/* Link created success */}
          {createdShare ? (
            <ShareCreatedCard
              share={createdShare}
              copied={copied === createdShare.id}
              onCopy={() => handleCopyUrl(createdShare)}
              onCreateAnother={() => setCreatedShare(null)}
            />
          ) : null}

          {/* 2-column config */}
          <div className="grid gap-3 md:grid-cols-2">
            {/* LEFT: Fields to share */}
            <div className="space-y-2 rounded-xl border border-[var(--border-soft)] bg-white p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--fg-muted)]">Chia sẻ gì</p>
              <div className="grid grid-cols-2 gap-1.5">
                {fieldOptions.map((opt) => (
                  <label
                    key={opt.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-all duration-150",
                      !opt.available && "pointer-events-none opacity-40",
                      opt.available && selectedFields.has(opt.id)
                        ? "border-[var(--accent)]/30 bg-[var(--accent)]/8 text-[var(--accent)]"
                        : opt.available
                          ? "border-[var(--border-soft)] text-[var(--fg-muted)] hover:border-[var(--accent)]/20 hover:text-[var(--fg-base)]"
                          : "border-dashed border-[var(--border-soft)] text-[var(--fg-muted)]",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      disabled={!opt.available}
                      checked={opt.available && selectedFields.has(opt.id)}
                      onChange={() => toggleField(opt.id)}
                    />
                    <span className={cn(
                      "flex size-3.5 shrink-0 items-center justify-center rounded border transition-all",
                      opt.available && selectedFields.has(opt.id)
                        ? "border-[var(--accent)] bg-[var(--accent)]"
                        : "border-current",
                    )}>
                      {opt.available && selectedFields.has(opt.id) && <Check className="size-2.5 text-white" />}
                    </span>
                    <span className="flex-1 truncate">{opt.label}</span>
                    {opt.sensitive && <Lock className="size-2.5 shrink-0 text-amber-400" />}
                  </label>
                ))}
              </div>

              {/* 2FA TOTP secret toggle */}
              {selectedFields.has("2fa") && (
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-amber-200/60 bg-amber-50/40 px-2.5 py-1.5 text-[11px] font-bold text-amber-700">
                  <input
                    type="checkbox"
                    checked={shareTotpSecret}
                    onChange={(e) => setShareTotpSecret(e.target.checked)}
                    className="size-3.5 rounded border-amber-300 text-amber-500"
                  />
                  <Zap className="size-3 shrink-0" />
                  Chia sẻ Key Secret 2FA gốc
                </label>
              )}

              {/* Specific credentials */}
              {shareableCredentials.length > 0 && (
                <div className="space-y-1 border-t border-[var(--border-soft)] pt-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--fg-muted)]">Credential riêng</p>
                    {selectedCredentialIds.size > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedCredentialIds(new Set())}
                        className="text-[10px] font-bold text-[var(--accent)] hover:underline"
                      >
                        Bỏ chọn
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-1">
                    {shareableCredentials.map((cred) => (
                      <label key={cred.id} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--border-soft)] px-2.5 py-1 text-[11px] font-bold transition-colors hover:bg-[var(--surface-light)]">
                        <input
                          type="checkbox"
                          checked={selectedCredentialIds.has(cred.id)}
                          onChange={() => toggleCredential(cred.id)}
                          className="size-3.5 rounded"
                        />
                        <span className="flex-1 truncate">{cred.label || cred.type}</span>
                        <span className="rounded bg-[var(--surface-light)] px-1 py-0.5 text-[9px] uppercase text-[var(--fg-muted)]">{cred.type}</span>
                        {isSensitiveCredential(cred) && <Lock className="size-2.5 text-amber-400" />}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT: Security + Config */}
            <div className="space-y-2">
              {/* Passcode */}
              <div className="rounded-xl border border-[var(--border-soft)] bg-white p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--fg-muted)]">Mã mở khóa</p>
                  {selectedContainsSensitive && (
                    <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-black uppercase text-amber-700">Bắt buộc</span>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <Input
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    disabled={allowNoPasscode}
                    placeholder="Tối thiểu 4 ký tự"
                    type="text"
                    className="font-mono text-sm h-8 flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => setPasscode(generatePasscode())}
                    disabled={allowNoPasscode}
                    title="Tạo mã ngẫu nhiên"
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-soft)] bg-[var(--surface-light)] text-[var(--fg-muted)] transition hover:text-[var(--accent)] disabled:opacity-40"
                  >
                    <Dice6 className="size-3.5" />
                  </button>
                </div>
                <div className="flex flex-col gap-1">
                  {!selectedContainsSensitive && (
                    <label className="flex cursor-pointer items-center gap-2 text-[11px] font-bold text-[var(--fg-muted)]">
                      <input
                        type="checkbox"
                        checked={allowNoPasscode}
                        onChange={(e) => setAllowNoPasscode(e.target.checked)}
                        className="size-3.5 rounded"
                      />
                      Không cần mã mở khóa
                    </label>
                  )}
                  <label className="flex cursor-pointer items-center gap-2 text-[11px] font-bold text-[var(--fg-muted)]">
                    <input
                      type="checkbox"
                      checked={lockToIp}
                      onChange={(e) => setLockToIp(e.target.checked)}
                      className="size-3.5 rounded"
                    />
                    Khóa IP sau lần đầu
                  </label>
                </div>
              </div>

              {/* Expiry presets */}
              <div className="rounded-xl border border-[var(--border-soft)] bg-white p-3 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--fg-muted)]">Thời hạn</p>
                <div className="flex gap-1 flex-wrap">
                  {EXPIRY_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handleSelectPreset(preset.hours)}
                      className={cn(
                        "rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-all duration-150",
                        selectedPreset === preset.hours
                          ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                          : "border-[var(--border-soft)] bg-[var(--surface-light)] text-[var(--fg-muted)] hover:border-[var(--accent)]/30 hover:text-[var(--fg-base)]",
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                {selectedPreset !== null && expiresAt && (
                  <Input
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => { setExpiresAt(e.target.value); setSelectedPreset(null); }}
                    className="h-8 text-xs"
                  />
                )}
              </div>

              {/* Limits */}
              <div className="rounded-xl border border-[var(--border-soft)] bg-white p-3 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--fg-muted)]">Giới hạn</p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1">
                    <span className="text-[10px] font-bold text-[var(--fg-muted)]">Lượt xem</span>
                    <Input type="number" min={1} max={500} value={maxViews} onChange={(e) => setMaxViews(Number(e.target.value) || 1)} className="h-8 text-xs" />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] font-bold text-[var(--fg-muted)]">Lượt mở khóa</span>
                    <Input type="number" min={1} max={500} value={maxUnlocks} onChange={(e) => setMaxUnlocks(Number(e.target.value) || 1)} className="h-8 text-xs" />
                  </label>
                </div>
              </div>

              {/* Title */}
              <div className="rounded-xl border border-[var(--border-soft)] bg-white p-3 space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--fg-muted)]">Tiêu đề</p>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tên link (tùy chọn)" className="h-8 text-xs" />
              </div>
            </div>
          </div>

          {/* Existing shares management */}
          {existingShares.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--fg-muted)]">Link đã tạo ({existingShares.length})</p>
              <div className="space-y-1.5">
                {existingShares.slice(0, 5).map((share) => (
                  <ShareManagementRow
                    key={share.id}
                    share={share}
                    copied={copied === share.id}
                    expanded={expandedLogsId === share.id}
                    onCopy={() => handleCopyUrl(share)}
                    onToggleStatus={() => handleToggleStatus(share)}
                    onDelete={() => setDeletingShareLink(share)}
                    onToggleLogs={() => setExpandedLogsId((cur) => cur === share.id ? null : share.id)}
                    isMutating={updateShare.isPending || deleteShare.isPending}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={!!deletingShareLink}
        onClose={() => setDeletingShareLink(null)}
        title="Thu hồi link"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeletingShareLink(null)}>Huỷ</Button>
            <Button
              variant="primary"
              onClick={submitDeleteShare}
              isLoading={deleteShare.isPending}
              className="!bg-[var(--danger)] hover:!bg-[var(--danger)]/90 !shadow-none"
            >
              Thu hồi
            </Button>
          </div>
        }
      >
        <div className="flex items-center gap-3 py-2">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-50">
            <Trash2 className="size-5 text-red-600" />
          </div>
          <p className="text-[13px] font-semibold text-[var(--fg-base)]">
            Khách sẽ không thể mở link này nữa.
          </p>
        </div>
      </Modal>
    </>
  );
}

function ShareCreatedCard({
  share, copied, onCopy, onCreateAnother,
}: {
  share: AccountShareLink;
  copied: boolean;
  onCopy: () => void;
  onCreateAnother: () => void;
}) {
  return (
    <div className="rounded-xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-white p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
          <Check className="size-4 text-emerald-600" />
        </div>
        <p className="text-[13px] font-black text-emerald-800">Link đã sẵn sàng</p>
        <div className="ml-auto flex items-center gap-1.5 text-[10px] font-bold text-emerald-700/80">
          {share.passcodeRequired && <><Lock className="size-3" /> Cần mã</>}
          {share.expiresAt && <><span>·</span> Hết hạn {formatCompactDate(share.expiresAt)}</>}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-white border border-emerald-200/60 px-3 py-2 text-[12px] font-bold text-emerald-900 shadow-inner">
          {share.publicUrl}
        </code>
        <button
          type="button"
          onClick={onCopy}
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg border transition-all duration-150",
            copied
              ? "border-emerald-400 bg-emerald-500 text-white"
              : "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50",
          )}
          title="Sao chép link"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </button>
        <a
          href={share.publicUrl}
          target="_blank"
          rel="noreferrer"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-white text-emerald-700 transition hover:bg-emerald-50"
          title="Mở link"
        >
          <ExternalLink className="size-4" />
        </a>
      </div>
      <button
        type="button"
        onClick={onCreateAnother}
        className="text-[11px] font-bold text-emerald-600 hover:underline"
      >
        + Tạo link khác
      </button>
    </div>
  );
}

function ShareManagementRow({
  share, copied, expanded, isMutating, onCopy, onToggleStatus, onDelete, onToggleLogs,
}: {
  share: AccountShareLink;
  copied: boolean;
  expanded: boolean;
  isMutating: boolean;
  onCopy: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
  onToggleLogs: () => void;
}) {
  const isActive = share.status === "active";
  return (
    <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-light)] px-3 py-2">
      <div className="flex items-center gap-2">
        <span className={cn(
          "rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase",
          isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600",
        )}>
          {isActive ? "ACTIVE" : share.status}
        </span>
        {share.passcodeRequired && <Lock className="size-3 text-amber-500" />}
        <p className="min-w-0 flex-1 truncate text-[11px] font-bold text-[var(--fg-base)]">
          {share.title || share.publicUrl}
        </p>
        <div className="flex shrink-0 items-center gap-0.5">
          <span className="text-[10px] font-semibold text-[var(--fg-muted)]">
            <Eye className="mr-0.5 inline size-3" />{share.viewCount}/{share.maxViews}
          </span>
          <IconButton onClick={onCopy} title="Sao chép">
            {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
          </IconButton>
          <IconButton onClick={onToggleStatus} disabled={isMutating} title={isActive ? "Tắt" : "Bật"}>
            {isActive ? <Ban className="size-3.5" /> : <RotateCcw className="size-3.5" />}
          </IconButton>
          <IconButton onClick={onToggleLogs} title="Nhật ký">
            <Activity className="size-3.5" />
          </IconButton>
          <IconButton onClick={onDelete} disabled={isMutating} title="Thu hồi" danger>
            <Trash2 className="size-3.5" />
          </IconButton>
        </div>
      </div>
      {expanded && <ShareLogs shareId={share.id} />}
    </div>
  );
}

function ShareLogs({ shareId }: { shareId: string }) {
  const { data: logs = [], isLoading } = useAccountShareLogs(shareId, true);
  return (
    <div className="mt-2 border-t border-[var(--border-soft)] pt-2">
      {isLoading ? (
        <div className="h-6 animate-pulse rounded bg-[var(--border-soft)]" />
      ) : logs.length === 0 ? (
        <p className="text-[11px] font-semibold text-[var(--fg-muted)]">Chưa có sự kiện.</p>
      ) : (
        <div className="max-h-40 space-y-1 overflow-y-auto">
          {logs.map((log) => <ShareLogRow key={log.id} log={log} />)}
        </div>
      )}
    </div>
  );
}

function ShareLogRow({ log }: { log: AccountShareAccessLog }) {
  return (
    <div className="grid gap-2 rounded-lg bg-white px-2.5 py-1.5 text-[10px] font-semibold text-[var(--fg-muted)] sm:grid-cols-[100px_1fr_auto]">
      <span className="font-black uppercase text-[var(--fg-base)]">{eventLabel(log.eventType)}</span>
      <span className="truncate">{log.reason || log.ipAddress || "—"}</span>
      <span className="whitespace-nowrap">{formatCompactDate(log.createdAt)}</span>
    </div>
  );
}

function IconButton({
  children, onClick, title, disabled, danger,
}: {
  children: ReactNode;
  onClick: () => void;
  title: string;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex size-7 items-center justify-center rounded-lg transition-colors hover:text-[var(--accent)] disabled:opacity-40",
        danger && "hover:text-[var(--danger)]",
      )}
    >
      {children}
    </button>
  );
}

function isSensitiveCredential(credential: DecryptedSourceAccountCredential) {
  return credential.type === "2fa" || credential.type === "2fa_backup" || credential.masked === true;
}

function formatCompactDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function eventLabel(eventType: AccountShareAccessLog["eventType"]) {
  switch (eventType) {
    case "unlock": return "Mở khóa";
    case "view": return "Xem";
    case "copy": return "Copy";
    case "totp_view": return "Xem 2FA";
    case "blocked": return "Chặn";
    default: return eventType;
  }
}
