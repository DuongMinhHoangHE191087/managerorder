"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  Ban,
  Check,
  Copy,
  Eye,
  Link2,
  Lock,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { appToast } from "@/shared/ui/app-toast";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Modal } from "@/shared/ui/modal";
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

const DEFAULT_EXPIRY = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
const CREDENTIAL_FIELD_TYPES = new Set<WarehouseCredentialType>(["link_join", "2fa", "2fa_backup", "duolingo_id", "other"]);

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
  const [expiresAt, setExpiresAt] = useState(DEFAULT_EXPIRY);
  const [maxViews, setMaxViews] = useState(20);
  const [maxUnlocks, setMaxUnlocks] = useState(10);
  const [passcode, setPasscode] = useState("");
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
    () => new Set((secrets?.credentials ?? []).map((credential) => credential.type)),
    [secrets?.credentials],
  );

  const shareableCredentials = useMemo(
    () => (secrets?.credentials ?? []).filter((credential) =>
      credential.shareable !== false && CREDENTIAL_FIELD_TYPES.has(credential.type),
    ),
    [secrets?.credentials],
  );

  const fieldOptions: FieldOption[] = [
    { id: "email", label: "Tài khoản", available: true },
    { id: "password", label: "Mật khẩu", sensitive: true, available: Boolean(secrets?.password) },
    { id: "link_join", label: "Link invite/join", available: credentialTypes.has("link_join") },
    { id: "duolingo_id", label: "Duolingo ID", available: credentialTypes.has("duolingo_id") },
    { id: "2fa", label: "2FA/TOTP", sensitive: true, available: credentialTypes.has("2fa") },
    { id: "2fa_backup", label: "Backup codes", sensitive: true, available: credentialTypes.has("2fa_backup") },
    { id: "other", label: "Trường khác", available: credentialTypes.has("other") },
  ];

  const selectedCredentialMode = selectedCredentialIds.size > 0;
  const selectedCredentialSensitive = shareableCredentials.some((credential) =>
    selectedCredentialIds.has(credential.id) && isSensitiveCredential(credential),
  );
  const selectedContainsSensitive = Boolean(secrets?.password && selectedFields.has("password"))
    || (selectedCredentialMode
      ? selectedCredentialSensitive
      : fieldOptions.some((option) => option.sensitive && selectedFields.has(option.id) && option.available));

  useEffect(() => {
    if (!isOpen) return;
    setTitle(`Thông tin ${account.email}`);
    setExpiresAt(DEFAULT_EXPIRY());
    setMaxViews(20);
    setMaxUnlocks(10);
    setPasscode("");
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
    setSelectedFields((current) => {
      const next = new Set(current);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  };

  const toggleCredential = (credentialId: string) => {
    setSelectedCredentialIds((current) => {
      const next = new Set(current);
      if (next.has(credentialId)) next.delete(credentialId);
      else next.add(credentialId);
      return next;
    });
  };

  const handleCreate = async () => {
    const fields = fieldOptions
      .filter((option) => option.available && selectedFields.has(option.id))
      .map((option) => option.id);
    if (fields.length === 0 && selectedCredentialIds.size === 0) {
      appToast.error("Chọn ít nhất một trường để chia sẻ");
      return;
    }

    if (!allowNoPasscode && passcode.trim().length < 4) {
      appToast.error("Nhập mã mở khóa tối thiểu 4 ký tự hoặc bật không cần mã");
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

  const handleDelete = (share: AccountShareLink) => {
    setDeletingShareLink(share);
  };

  const submitDeleteShare = async () => {
    if (!deletingShareLink) return;
    await deleteShare.mutateAsync(deletingShareLink);
    if (expandedLogsId === deletingShareLink.id) setExpandedLogsId(null);
    setDeletingShareLink(null);
    appToast.success("Đã thu hồi link share");
  };

  return (
    <>
      <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Chia sẻ tài khoản"
      size="2xl"
      footer={
        <div className="flex justify-end gap-2">
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
      }
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)] px-4 py-3">
          <div className="flex items-center gap-2 text-[13px] font-bold text-[var(--fg-base)]">
            <ShieldCheck className="size-4 text-[var(--accent)]" />
            {account.email}
          </div>
          <p className="mt-1 text-[12px] font-medium text-[var(--fg-muted)]">
            Secret chỉ hiển thị ở trang share sau khi mở khóa. Link nhạy cảm bắt buộc có mã mở khóa ở cả UI và API.
          </p>
        </div>

        {createdShare ? (
          <ShareCreatedCard share={createdShare} copied={copied === createdShare.id} onCopy={() => handleCopyUrl(createdShare)} />
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Tiêu đề</span>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Hết hạn</span>
            <Input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
          </label>
          <label className="space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Lượt xem</span>
            <Input type="number" min={1} max={500} value={maxViews} onChange={(event) => setMaxViews(Number(event.target.value) || 1)} />
          </label>
          <label className="space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Lượt mở khóa</span>
            <Input type="number" min={1} max={500} value={maxUnlocks} onChange={(event) => setMaxUnlocks(Number(event.target.value) || 1)} />
          </label>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Nhóm trường chia sẻ</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {fieldOptions.map((option) => (
              <label
                key={option.id}
                className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-[12px] font-bold transition ${
                  option.available
                    ? "border-[var(--border-soft)] bg-white text-[var(--fg-base)]"
                    : "border-[var(--border-soft)] bg-gray-50 text-[var(--fg-muted)] opacity-60"
                }`}
              >
                <input
                  type="checkbox"
                  disabled={!option.available}
                  checked={option.available && selectedFields.has(option.id)}
                  onChange={() => toggleField(option.id)}
                  className="size-4 rounded border-[var(--border-soft)]"
                />
                {option.label}
                {option.sensitive ? <Lock className="ml-auto size-3 text-amber-500" /> : null}
              </label>
            ))}
          </div>
        </div>

        {selectedFields.has("2fa") ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 space-y-2">
            <label className="flex items-center gap-2 text-[12px] font-bold text-[var(--fg-base)]">
              <input
                type="checkbox"
                checked={shareTotpSecret}
                onChange={(event) => setShareTotpSecret(event.target.checked)}
                className="size-4 rounded border-[var(--border-soft)]"
              />
              Chia sẻ cả Key Secret 2FA gốc (Mã QR/Khóa thiết lập gốc)
            </label>
            <p className="text-[11px] font-medium text-[var(--fg-muted)] pl-6 leading-relaxed">
              Mặc định khi chia sẻ 2FA, hệ thống chỉ hiển thị mã 6 số thay đổi liên tục trên trang khách hàng. 
              Nếu tích chọn ô này, khách hàng sẽ xem được và sao chép được cả Key Secret gốc để tự quét mã vào Google Authenticator.
            </p>
          </div>
        ) : null}

        {shareableCredentials.length > 0 ? (
          <div className="space-y-2 rounded-2xl border border-[var(--border-soft)] bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Chọn credential chi tiết</p>
              <button
                type="button"
                onClick={() => setSelectedCredentialIds(new Set())}
                className="text-[11px] font-bold text-[var(--accent)]"
              >
                Dùng theo nhóm
              </button>
            </div>
            <p className="text-[12px] font-medium text-[var(--fg-muted)]">
              Khi tick credential ở đây, public payload chỉ trả các credential được chọn. Tài khoản và mật khẩu vẫn theo nhóm trường bên trên.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {shareableCredentials.map((credential) => (
                <label key={credential.id} className="flex items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-light)] px-3 py-2 text-[12px] font-bold">
                  <input
                    type="checkbox"
                    checked={selectedCredentialIds.has(credential.id)}
                    onChange={() => toggleCredential(credential.id)}
                    className="size-4 rounded border-[var(--border-soft)]"
                  />
                  <span className="min-w-0 flex-1 truncate">{credential.label || credential.type}</span>
                  <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] uppercase text-[var(--fg-muted)]">{credential.type}</span>
                  {isSensitiveCredential(credential) ? <Lock className="size-3 text-amber-500" /> : null}
                </label>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)] p-4">
          <label className="flex items-center gap-2 text-[12px] font-bold text-[var(--fg-base)]">
            <input
              type="checkbox"
              checked={allowNoPasscode}
              onChange={(event) => setAllowNoPasscode(event.target.checked)}
              disabled={selectedContainsSensitive}
              className="size-4 rounded border-[var(--border-soft)]"
            />
            Không cần mã mở khóa
          </label>
          {selectedContainsSensitive ? (
            <p className="text-[12px] font-semibold text-amber-700">
              Có mật khẩu/2FA/credential nhạy cảm nên hệ thống bắt buộc dùng mã mở khóa.
            </p>
          ) : null}
          <label className="space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Mã mở khóa</span>
            <Input
              value={passcode}
              onChange={(event) => setPasscode(event.target.value)}
              disabled={allowNoPasscode}
              placeholder="Ví dụ: 482913"
              type="text"
              className="font-mono"
            />
          </label>
          <label className="flex items-center gap-2 text-[12px] font-bold text-[var(--fg-base)]">
            <input
              type="checkbox"
              checked={lockToIp}
              onChange={(event) => setLockToIp(event.target.checked)}
              className="size-4 rounded border-[var(--border-soft)]"
            />
            Khóa theo IP sau lần mở đầu tiên
          </label>
        </div>

        {existingShares.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Quản lý link đã tạo</p>
            <div className="space-y-2">
              {existingShares.slice(0, 6).map((share) => (
                <ShareManagementRow
                  key={share.id}
                  share={share}
                  copied={copied === share.id}
                  expanded={expandedLogsId === share.id}
                  onCopy={() => handleCopyUrl(share)}
                  onToggleStatus={() => handleToggleStatus(share)}
                  onDelete={() => handleDelete(share)}
                  onToggleLogs={() => setExpandedLogsId((current) => current === share.id ? null : share.id)}
                  isMutating={updateShare.isPending || deleteShare.isPending}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Modal>

    <Modal
      isOpen={!!deletingShareLink}
      onClose={() => setDeletingShareLink(null)}
      title="Thu hồi link chia sẻ"
      size="sm"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeletingShareLink(null)}>
            Huỷ
          </Button>
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
      <div className="text-center py-4">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-[var(--danger)]/10">
          <Trash2 className="size-6 text-[var(--danger)]" />
        </div>
        <p className="mb-2 text-[14px] font-bold text-[var(--fg-base)]">Thu hồi link chia sẻ này?</p>
        <p className="text-[12px] text-[var(--fg-muted)]">
          Khách hàng sẽ không thể mở hoặc truy cập thông tin tài khoản qua link này nữa.
        </p>
      </div>
    </Modal>
    </>
  );
}

function ShareCreatedCard({ share, copied, onCopy }: { share: AccountShareLink; copied: boolean; onCopy: () => void }) {
  return (
    <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3">
      <p className="text-[11px] font-black uppercase tracking-widest text-green-700">Link đã tạo</p>
      <div className="mt-2 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-xl bg-white px-3 py-2 text-[12px] font-bold text-green-900">
          {share.publicUrl}
        </code>
        <button
          type="button"
          onClick={onCopy}
          className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-green-700"
          title="Sao chép"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </button>
      </div>
    </div>
  );
}

function ShareManagementRow({
  share,
  copied,
  expanded,
  isMutating,
  onCopy,
  onToggleStatus,
  onDelete,
  onToggleLogs,
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
  return (
    <div className="rounded-2xl border border-[var(--border-soft)] bg-white px-3 py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
              share.status === "active" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
            }`}>
              {share.status}
            </span>
            {share.passcodeRequired ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase text-amber-700">
                <Lock className="size-3" /> mã mở khóa
              </span>
            ) : null}
            {share.accessPolicy.lockToIp ? (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black uppercase text-blue-700">IP lock</span>
            ) : null}
          </div>
          <p className="mt-1 truncate text-[12px] font-bold text-[var(--fg-base)]">{share.publicUrl}</p>
          <div className="mt-1 flex flex-wrap gap-3 text-[11px] font-semibold text-[var(--fg-muted)]">
            <span className="inline-flex items-center gap-1"><Eye className="size-3" /> {share.viewCount}/{share.maxViews}</span>
            <span className="inline-flex items-center gap-1"><Activity className="size-3" /> {share.unlockCount}/{share.maxUnlocks}</span>
            {share.expiresAt ? <span>Hết hạn {formatCompactDate(share.expiresAt)}</span> : <span>Không hết hạn</span>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <IconButton onClick={onCopy} title="Sao chép link">
            {copied ? <Check className="size-4 text-green-700" /> : <Copy className="size-4" />}
          </IconButton>
          <IconButton onClick={onToggleStatus} disabled={isMutating} title={share.status === "active" ? "Tắt link" : "Bật lại link"}>
            {share.status === "active" ? <Ban className="size-4" /> : <RotateCcw className="size-4" />}
          </IconButton>
          <IconButton onClick={onToggleLogs} title="Xem audit">
            <Activity className="size-4" />
          </IconButton>
          <IconButton onClick={onDelete} disabled={isMutating} title="Thu hồi link">
            <Trash2 className="size-4 text-red-600" />
          </IconButton>
        </div>
      </div>
      {expanded ? <ShareLogs shareId={share.id} /> : null}
    </div>
  );
}

function ShareLogs({ shareId }: { shareId: string }) {
  const { data: logs = [], isLoading } = useAccountShareLogs(shareId, true);
  return (
    <div className="mt-3 border-t border-[var(--border-soft)] pt-3">
      {isLoading ? (
        <p className="text-[12px] font-semibold text-[var(--fg-muted)]">Đang tải audit...</p>
      ) : logs.length === 0 ? (
        <p className="text-[12px] font-semibold text-[var(--fg-muted)]">Chưa có audit event.</p>
      ) : (
        <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
          {logs.map((log) => <ShareLogRow key={log.id} log={log} />)}
        </div>
      )}
    </div>
  );
}

function ShareLogRow({ log }: { log: AccountShareAccessLog }) {
  return (
    <div className="grid gap-1 rounded-xl bg-[var(--surface-light)] px-3 py-2 text-[11px] font-semibold text-[var(--fg-muted)] sm:grid-cols-[120px_1fr_auto]">
      <span className="font-black uppercase text-[var(--fg-base)]">{eventLabel(log.eventType)}</span>
      <span className="truncate">{log.reason || log.ipAddress || "Không có IP"}</span>
      <span>{formatCompactDate(log.createdAt)}</span>
    </div>
  );
}

function IconButton({
  children,
  onClick,
  title,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  title: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="flex size-8 items-center justify-center rounded-lg bg-[var(--surface-light)] text-[var(--fg-muted)] transition hover:text-[var(--accent)] disabled:opacity-50"
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
    case "unlock":
      return "Mở khóa";
    case "view":
      return "Xem";
    case "copy":
      return "Copy";
    case "totp_view":
      return "Xem 2FA";
    case "blocked":
      return "Chặn";
    default:
      return eventType;
  }
}
