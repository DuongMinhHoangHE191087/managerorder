"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  Check,
  Copy,
  Edit2,
  ExternalLink,
  Eye,
  EyeOff,
  Key,
  Link2,
  MoreHorizontal,
  RefreshCw,
  Shield,
  ShieldAlert,
  Users,
  Zap,
} from "lucide-react";

import { appToast } from "@/shared/ui/app-toast";
import { formatDateLabel, formatMoney } from "@/lib/utils";
import type { Provider, SourceAccount, WarehouseCredentialType } from "@/lib/domain/types";
import {
  useSourceAccountDecrypt,
  useSourceAccountTotp,
  type DecryptedSourceAccountCredential,
} from "@/widgets/pages/inventory/hooks/use-source-accounts";
import { INVENTORY_COPY as copy } from "../copy";

const drawerText = copy.inventoryDetailDrawer;
const MASKED_VALUE = "********";

type CredentialMeta = {
  label: string;
  icon: React.FC<{ className?: string }>;
  color: string;
  sensitive?: boolean;
};

const CRED_META: Record<WarehouseCredentialType, CredentialMeta> = {
  link_join: { label: drawerText.credentialLabels.linkJoin, icon: Link2, color: "text-blue-500" },
  duolingo_id: { label: drawerText.credentialLabels.duolingoId, icon: Zap, color: "text-green-500" },
  "2fa": { label: drawerText.credentialLabels.twoFa, icon: Shield, color: "text-amber-500", sensitive: true },
  "2fa_backup": { label: drawerText.credentialLabels.twoFaBackup, icon: ShieldAlert, color: "text-red-500", sensitive: true },
  other: { label: drawerText.credentialLabels.other, icon: MoreHorizontal, color: "text-gray-500" },
};

interface InventoryDetailDrawerProps {
  account: SourceAccount;
  productMap: Map<string, string>;
  providerById: Map<string, Provider>;
  onEdit: () => void;
  onRecalculate: () => Promise<void>;
  isRecalculating?: boolean;
  children?: React.ReactNode;
}

type InventoryCredentialRowProps = {
  cred: DecryptedSourceAccountCredential;
  meta: CredentialMeta;
  isSensitive: boolean;
  isRevealed: boolean;
  isCopied: boolean;
  sourceAccountId: string;
  onToggleSensitive: (id: string) => void;
  onCopy: (value: string, id: string) => void;
};

const InventoryCredentialRow = memo(function InventoryCredentialRow({
  cred,
  meta,
  isSensitive,
  isRevealed,
  isCopied,
  sourceAccountId,
  onToggleSensitive,
  onCopy,
}: InventoryCredentialRowProps) {
  const Icon = meta.icon;
  const isTotp = cred.type === "2fa" && (cred.format === "totp_secret" || cred.value.startsWith("otpauth://") || cred.value.toLowerCase().startsWith("totp:"));
  const totpQuery = useSourceAccountTotp(sourceAccountId, cred.id, isTotp);
  const displayValue = isTotp
    ? (totpQuery.data?.code ?? "------")
    : isSensitive && !isRevealed ? MASKED_VALUE : cred.value;
  const isUrl = cred.type === "link_join" && cred.value?.startsWith("http");

  return (
    <div className="group flex items-center gap-2.5 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-app)]/50 p-2.5 transition-colors hover:border-[var(--accent)]/30">
      <div
        className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
          cred.type === "link_join"
            ? "bg-blue-100"
            : cred.type === "duolingo_id"
              ? "bg-green-100"
              : cred.type === "2fa"
                ? "bg-amber-100"
                : cred.type === "2fa_backup"
                  ? "bg-red-100"
                  : "bg-gray-100"
        }`}
      >
        <Icon className={`size-4 ${meta.color}`} />
      </div>
      <div className="min-w-0 flex-1">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
          {cred.label || meta.label}
        </span>
        {isUrl ? (
          <a
            href={cred.value}
            target="_blank"
            rel="noopener noreferrer"
            className="block max-w-[200px] truncate text-[12px] font-medium text-blue-600 hover:underline"
          >
            {cred.value}
          </a>
        ) : (
          <span className="block max-w-[200px] truncate font-mono text-[12px] font-medium text-[var(--fg-base)]">
            {displayValue}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {isTotp && totpQuery.data ? (
          <span className="rounded bg-lime-100 px-1.5 py-0.5 text-[10px] font-bold text-lime-700">
            {totpQuery.data.remainingSeconds}s
          </span>
        ) : null}
        {isSensitive && !isTotp ? (
          <button
            type="button"
            onClick={() => onToggleSensitive(cred.id)}
            className="rounded p-1 transition-colors hover:bg-gray-100"
            title={isRevealed ? drawerText.hide : drawerText.show}
          >
            {isRevealed ? <EyeOff className="size-3 text-[var(--fg-muted)]" /> : <Eye className="size-3 text-[var(--fg-muted)]" />}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onCopy(isTotp && totpQuery.data ? totpQuery.data.code : cred.value, cred.id)}
          disabled={isTotp && !totpQuery.data}
          className="rounded p-1 transition-colors hover:bg-gray-100"
          title={drawerText.copy}
        >
          {isCopied ? <Check className="size-3 text-green-500" /> : <Copy className="size-3 text-[var(--fg-muted)]" />}
        </button>
        {isUrl ? (
          <a
            href={cred.value}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded p-1 transition-colors hover:bg-gray-100"
            title={drawerText.openLink}
          >
            <ExternalLink className="size-3 text-[var(--fg-muted)]" />
          </a>
        ) : null}
      </div>
    </div>
  );
});

export function InventoryDetailDrawer({
  account,
  productMap,
  providerById,
  onEdit,
  onRecalculate,
  isRecalculating,
  children,
}: InventoryDetailDrawerProps) {
  const text = drawerText;
  const [showPassword, setShowPassword] = useState(false);
  const [visibleSensitive, setVisibleSensitive] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { data: decryptedSecrets, isLoading: loadingCreds } = useSourceAccountDecrypt(account.id);

  const decryptedCreds = useMemo(() => decryptedSecrets?.credentials ?? [], [decryptedSecrets?.credentials]);
  const decryptedPassword = decryptedSecrets?.password ?? null;
  const productNames = useMemo(
    () => account.productIds.map((pid) => productMap.get(pid) || pid).join(", "),
    [account.productIds, productMap],
  );
  const credentialValueByType = useMemo(() => {
    const map = new Map<string, string>();
    for (const cred of decryptedCreds) {
      if (!map.has(cred.type)) {
        map.set(cred.type, cred.value);
      }
    }
    return map;
  }, [decryptedCreds]);

  useEffect(() => {
    setShowPassword(false);
    setVisibleSensitive(new Set());
    setCopiedId(null);
  }, [account.id]);

  const handleCopy = useCallback((value: string, id: string) => {
    navigator.clipboard.writeText(value);
    setCopiedId(id);
    appToast.success(text.copy);
    setTimeout(() => setCopiedId(null), 2000);
  }, [text.copy]);

  const toggleSensitive = useCallback((id: string) => {
    setVisibleSensitive((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const [now] = useState(() => Date.now());
  const expiresDate = new Date(account.expiresAt);
  const daysUntilExpiry = Math.ceil((expiresDate.getTime() - now) / (1000 * 60 * 60 * 24));
  const isExpired = daysUntilExpiry < 0;
  const isExpiringSoon = daysUntilExpiry >= 0 && daysUntilExpiry <= 7;
  const slotsPercent = account.maxSlots > 0 ? Math.round((account.usedSlots / account.maxSlots) * 100) : 0;
  const isFull = account.usedSlots >= account.maxSlots;
  const freeSlots = Math.max(0, account.maxSlots - account.usedSlots);

  const providerName = providerById.get(account.provider)?.name || account.provider;
  const inviteLink = credentialValueByType.get("link_join");
  const duolingoInfo = credentialValueByType.get("duolingo_id");

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-2 rounded-[1rem] border border-[var(--border-soft)] bg-[var(--surface-light)] py-2.5 text-[12px] font-bold text-[var(--fg-base)] transition-[background-color,border-color,box-shadow,color,opacity,transform,width] hover:border-[var(--accent)]/30 hover:bg-white hover:text-[var(--accent)] active:scale-[0.98]"
        >
          <Edit2 className="size-3.5" /> {text.edit}
        </button>
        <button
          type="button"
          onClick={onRecalculate}
          disabled={isRecalculating}
          className="flex-1 flex items-center justify-center gap-2 rounded-[1rem] border border-[var(--border-soft)] bg-[var(--surface-light)] py-2.5 text-[12px] font-bold text-[var(--fg-base)] transition-[background-color,border-color,box-shadow,color,opacity,transform,width] hover:border-blue-500/30 hover:bg-blue-500/5 hover:text-blue-500 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
        >
          <RefreshCw className={`size-3.5 ${isRecalculating ? "animate-spin" : ""}`} />
          {isRecalculating ? text.syncing : text.sync}
        </button>
      </div>

      <div className="app-card overflow-hidden border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
        <div className="border-b border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,244,0.84))] px-4 py-3">
          <h3 className="text-[12px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">{text.accountInfoTitle}</h3>
        </div>
        <div className="space-y-3 p-4">
          <InfoRow label={text.email} value={account.email} copyable onCopy={() => handleCopy(account.email, "email")} copied={copiedId === "email"} />
          <InfoRow label={text.provider} value={providerName} />
          <InfoRow label={text.products} value={productNames} />
          {decryptedPassword ? (
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium text-[var(--fg-muted)]">{text.password}</span>
              <div className="flex items-center gap-1.5">
                <span className="max-w-[180px] truncate font-mono text-[12px] font-bold text-[var(--fg-base)]">
                  {showPassword ? decryptedPassword : MASKED_VALUE}
                </span>
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="rounded p-1 transition-colors hover:bg-gray-100"
                  title={showPassword ? text.hide : text.show}
                >
                  {showPassword ? <EyeOff className="size-3 text-[var(--fg-muted)]" /> : <Eye className="size-3 text-[var(--fg-muted)]" />}
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy(decryptedPassword, "pwd")}
                  className="rounded p-1 transition-colors hover:bg-gray-100"
                  title={text.copy}
                >
                  {copiedId === "pwd" ? <Check className="size-3 text-green-500" /> : <Copy className="size-3 text-[var(--fg-muted)]" />}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="app-card overflow-hidden border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
        <div className="border-b border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,244,0.84))] px-4 py-3">
          <h3 className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
            <Users className="size-3.5 text-[var(--accent)]" />
            {text.slotsTitle}
          </h3>
        </div>
        <div className="space-y-4 p-4">
          <div>
            <div className="mb-2 flex items-end justify-between">
              <div>
                <span className="text-3xl font-black text-[var(--fg-base)]">{account.usedSlots}</span>
                <span className="text-lg font-medium text-[var(--fg-muted)]"> / {account.maxSlots}</span>
              </div>
              <div className="text-right">
                <span className={`text-[13px] font-bold ${isFull ? "text-red-500" : slotsPercent > 80 ? "text-amber-500" : "text-[var(--accent)]"}`}>
                  {slotsPercent}% {text.usedSuffix}
                </span>
                <div className={`text-[11px] font-medium ${freeSlots === 0 ? "text-red-500" : "text-blue-500"}`}>
                  {text.freeLabel(freeSlots)}
                </div>
              </div>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full transition-[background-color,border-color,box-shadow,color,opacity,transform,width] duration-500 ${
                  isFull
                    ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                    : slotsPercent > 80
                      ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]"
                      : "bg-[var(--accent)] shadow-[0_0_8px_rgba(85,202,2,0.4)]"
                }`}
                style={{ width: `${Math.min(100, slotsPercent)}%` }}
              />
            </div>
          </div>

          <div
            className={`flex items-center justify-between rounded-lg border px-3 py-2.5 ${
              isExpired ? "border-red-200 bg-red-50" : isExpiringSoon ? "border-amber-200 bg-amber-50" : "border-green-200 bg-green-50"
            }`}
          >
            <div className="flex items-center gap-2">
              <Calendar className={`size-4 ${isExpired ? "text-red-500" : isExpiringSoon ? "text-amber-500" : "text-green-500"}`} />
              <span className="text-[12px] font-medium text-[var(--fg-muted)]">{text.expiryLabel}</span>
            </div>
            <div className="text-right">
              <div className="text-[13px] font-bold text-[var(--fg-base)]">{formatDateLabel(account.expiresAt)}</div>
              <div className={`text-[10px] font-bold ${isExpired ? "text-red-500" : isExpiringSoon ? "text-amber-500" : "text-green-600"}`}>
                {isExpired ? (
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="size-3" />
                    {text.expiredLabel} ({text.expiredDaysAgo(Math.abs(daysUntilExpiry))})
                  </span>
                ) : isExpiringSoon ? (
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="size-3" />
                    {text.daysLeft(daysUntilExpiry)}
                  </span>
                ) : (
                  <span>{text.daysLeft(daysUntilExpiry)}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="app-card overflow-hidden border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
        <div className="border-b border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,244,0.84))] px-4 py-3">
          <h3 className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
            <Key className="size-3.5 text-[var(--accent)]" />
            {text.loginInfoTitle(loadingCreds ? 0 : decryptedCreds.length)}
          </h3>
        </div>
        <div className="p-3">
          {loadingCreds ? (
            <div className="flex items-center justify-center py-6 text-[var(--fg-muted)]">
              <RefreshCw className="mr-2 size-4 animate-spin" />
              <span className="text-[12px]">{text.decrypting}</span>
            </div>
          ) : decryptedCreds.length === 0 ? (
            <div className="py-4 text-center">
              <p className="text-[12px] italic text-[var(--fg-muted)]">{text.noLoginInfo}</p>
              <button
                type="button"
                onClick={onEdit}
                className="mt-2 text-[11px] font-bold text-[var(--accent)] hover:underline"
              >
                {text.addNow}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {decryptedCreds.map((cred) => {
                const meta = CRED_META[cred.type as WarehouseCredentialType] || CRED_META.other;
                const isSensitive = Boolean(meta.sensitive);
                const isRevealed = visibleSensitive.has(cred.id);

                return (
                  <InventoryCredentialRow
                    key={cred.id}
                    cred={cred}
                    meta={meta}
                    isSensitive={isSensitive}
                    isRevealed={isRevealed}
                    isCopied={copiedId === cred.id}
                    sourceAccountId={account.id}
                    onToggleSensitive={toggleSensitive}
                    onCopy={handleCopy}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {duolingoInfo ? (
        <div className="flex items-center gap-2.5 rounded-xl border border-green-200 bg-green-50/60 px-4 py-3">
          <Zap className="size-5 shrink-0 text-green-600" />
          <div className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-green-700">{text.duolingoAccount}</span>
            <span className="block truncate font-mono text-[12px] font-medium text-green-800">{duolingoInfo}</span>
          </div>
          {inviteLink ? (
            <button
              type="button"
              onClick={() => handleCopy(inviteLink, "invite")}
              className="flex shrink-0 items-center gap-1 rounded-lg bg-green-100 px-2.5 py-1.5 text-[10px] font-bold text-green-600 transition-colors hover:bg-green-200"
            >
              {copiedId === "invite" ? <Check className="size-3" /> : <Copy className="size-3" />}
              {text.inviteLink}
            </button>
          ) : null}
        </div>
      ) : null}

      {account.purchaseCostVnd || account.purchaseDate || account.purchaseSource ? (
        <div className="app-card overflow-hidden border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
          <div className="border-b border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,244,0.84))] px-4 py-3">
            <h3 className="text-[12px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">{text.costTitle}</h3>
          </div>
          <div className="space-y-2 p-4">
            {account.purchaseCostVnd != null && account.purchaseCostVnd > 0 ? (
              <InfoRow label={text.purchasePrice} value={formatMoney(account.purchaseCostVnd)} />
            ) : null}
            {account.purchaseDate ? <InfoRow label={text.purchaseDate} value={formatDateLabel(account.purchaseDate)} /> : null}
            {account.purchaseSource ? <InfoRow label={text.purchaseSource} value={account.purchaseSource} /> : null}
          </div>
        </div>
      ) : null}

      {children}
    </div>
  );
}

const InfoRow = memo(function InfoRow({
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
    <div className="flex items-center justify-between">
      <span className="text-[12px] font-medium text-[var(--fg-muted)]">{label}</span>
      <div className="flex max-w-[60%] items-center gap-1.5">
        <span className="truncate text-[12px] font-bold text-[var(--fg-base)]">{value}</span>
        {copyable && onCopy ? (
          <button
            type="button"
            onClick={onCopy}
            className="shrink-0 rounded p-0.5 transition-colors hover:bg-gray-100"
            title={copy.inventoryDetailDrawer.copy}
          >
            {copied ? <Check className="size-3 text-green-500" /> : <Copy className="size-3 text-[var(--fg-muted)]" />}
          </button>
        ) : null}
      </div>
    </div>
  );
});
