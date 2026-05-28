"use client";

import { useCallback, useEffect, useState, useTransition, type FormEvent } from "react";
import { Check, Copy, KeyRound, Loader2, Lock, ShieldCheck, Eye, Clock, AlertTriangle } from "lucide-react";

type ShareSummary = {
  slug: string;
  title: string | null;
  status: "active" | "disabled" | "expired" | "not_found";
  passcodeRequired: boolean;
  expiresAt: string | null;
  locked: boolean;
  reason?: string;
};

type ShareCredential = {
  id: string;
  type: string;
  label: string;
  value: string | null;
  format?: string;
  masked: boolean;
  totpAvailable: boolean;
};

type SharePayload = {
  id: string;
  slug: string;
  title: string | null;
  email: string | null;
  password: string | null;
  credentials: ShareCredential[];
  expiresAt: string | null;
  remainingViews: number | null;
};

type TotpState = {
  code: string;
  remainingSeconds: number;
  period: number;
};

export function AccountSharePublicView({ slug }: { slug: string }) {
  const [summary, setSummary] = useState<ShareSummary | null>(null);
  const [payload, setPayload] = useState<SharePayload | null>(null);
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  const loadPayload = useCallback(async () => {
    const result = await fetchJson<SharePayload>(`/api/share/${slug}/payload`);
    if (!result.ok) {
      setError(result.error);
      setPayload(null);
      return;
    }
    setPayload(result.data);
    setSummary((current) => current ? { ...current, locked: false } : current);
  }, [slug]);

  const loadSummaryAndPayload = useCallback(async () => {
    setError(null);
    setLoading(true);
    const summaryResult = await fetchJson<ShareSummary>(`/api/share/${slug}`);
    if (!summaryResult.ok) {
      setSummary({
        slug,
        title: null,
        status: "not_found",
        passcodeRequired: false,
        expiresAt: null,
        locked: true,
        reason: "not_found",
      });
      setLoading(false);
      return;
    }

    setSummary(summaryResult.data);
    if (!summaryResult.data.locked) {
      await loadPayload();
    }
    setLoading(false);
  }, [loadPayload, slug]);

  useEffect(() => {
    startTransition(() => {
      void loadSummaryAndPayload();
    });
  }, [loadSummaryAndPayload]);

  async function handleUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(() => {
      void (async () => {
        const result = await fetchJson<{ unlocked: boolean }>(`/api/share/${slug}/unlock`, {
          method: "POST",
          body: JSON.stringify({ passcode }),
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        await loadPayload();
      })();
    });
  }

  async function copyValue(value: string, id: string) {
    await navigator.clipboard.writeText(value);
    setCopied(id);
    setTimeout(() => setCopied(null), 1800);
    void fetch(`/api/share/${slug}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType: "copy", metadata: { field: id } }),
    });
  }

  if (loading && !summary) {
    return <LoadingScreen />;
  }

  if (!summary || summary.status === "not_found") {
    return <ErrorScreen reason="not_found" />;
  }

  if (summary.reason && summary.reason !== "locked") {
    return <ErrorScreen reason={summary.reason} />;
  }

  return (
    <ShareLayout>
      <div className="share-card">
        {/* Header */}
        <div className="share-card-header">
          <div className="share-brand">
            <div className="share-brand-icon">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <p className="share-brand-label">ManagerOrder · Chia sẻ bảo mật</p>
              <h1 className="share-title">
                {summary.title || payload?.title || "Thông tin tài khoản"}
              </h1>
            </div>
          </div>
          <StatusBadge status={summary.status} expiresAt={summary.expiresAt} />
        </div>

        {/* Meta bar */}
        {payload && (
          <div className="share-meta-bar">
            {payload.remainingViews !== null && (
              <div className="share-meta-item">
                <Eye className="size-3.5 shrink-0" />
                <span>Còn {payload.remainingViews} lượt xem</span>
              </div>
            )}
            {payload.expiresAt && (
              <div className="share-meta-item">
                <Clock className="size-3.5 shrink-0" />
                <span>{formatExpiry(payload.expiresAt)}</span>
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div className="share-card-body">
          {summary.locked ? (
            <form onSubmit={handleUnlock} className="share-lock-form">
              <div className="share-lock-notice">
                <Lock className="size-4 shrink-0 text-amber-400" />
                <span>Liên kết này cần mã mở khóa để xem thông tin.</span>
              </div>
              <div className="share-input-group">
                <label className="share-input-label">Mã mở khóa</label>
                <div className="share-input-wrapper">
                  <KeyRound className="share-input-icon" />
                  <input
                    value={passcode}
                    onChange={(event) => setPasscode(event.target.value)}
                    type="password"
                    autoComplete="one-time-code"
                    placeholder="Nhập mã mở khóa..."
                    className="share-input"
                  />
                </div>
              </div>
              {error ? (
                <div className="share-error">
                  <AlertTriangle className="size-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : null}
              <button type="submit" disabled={pending} className="share-unlock-btn">
                {pending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                {pending ? "Đang mở khóa..." : "Mở khóa"}
              </button>
            </form>
          ) : payload ? (
            <div className="share-fields">
              {payload.email ? (
                <FieldRow
                  label="Tài khoản"
                  value={payload.email}
                  copied={copied === "email"}
                  onCopy={() => copyValue(payload.email!, "email")}
                />
              ) : null}
              {payload.password ? (
                <FieldRow
                  label="Mật khẩu"
                  value={payload.password}
                  copied={copied === "password"}
                  onCopy={() => copyValue(payload.password!, "password")}
                  sensitive
                />
              ) : null}
              {payload.credentials.map((credential) =>
                credential.totpAvailable ? (
                  <TotpRow
                    key={credential.id}
                    slug={slug}
                    credential={credential}
                    onCopy={copyValue}
                    copiedState={copied}
                  />
                ) : credential.value ? (
                  <FieldRow
                    key={credential.id}
                    label={credential.label}
                    value={credential.value}
                    copied={copied === credential.id}
                    onCopy={() => copyValue(credential.value!, credential.id)}
                    sensitive={credential.masked}
                  />
                ) : null
              )}
            </div>
          ) : (
            <div className="share-loading-inline">
              <Loader2 className="size-4 animate-spin opacity-60" />
              <span>Đang tải thông tin...</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="share-card-footer">
          <ShieldCheck className="size-3.5 shrink-0 text-emerald-400" />
          <span>Nội dung được mã hóa · Truy cập có giới hạn · ManagerOrder</span>
        </div>
      </div>

      <style>{shareStyles}</style>
    </ShareLayout>
  );
}

// ─── Layout & Shell ───────────────────────────────────────────

function ShareLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="share-root">
      <div className="share-bg-orb share-bg-orb-1" />
      <div className="share-bg-orb share-bg-orb-2" />
      <div className="share-container">
        {children}
      </div>
    </main>
  );
}

function LoadingScreen() {
  return (
    <ShareLayout>
      <div className="share-shell">
        <div className="share-shell-icon share-shell-icon--loading">
          <Loader2 className="size-7 animate-spin" />
        </div>
        <h2 className="share-shell-title">Đang kiểm tra...</h2>
        <p className="share-shell-desc">Đang xác thực liên kết chia sẻ</p>
      </div>
      <style>{shareStyles}</style>
    </ShareLayout>
  );
}

function ErrorScreen({ reason }: { reason: string }) {
  const isNotFound = reason === "not_found";
  return (
    <ShareLayout>
      <div className="share-shell">
        <div className={`share-shell-icon ${isNotFound ? "share-shell-icon--error" : "share-shell-icon--warn"}`}>
          {isNotFound ? <AlertTriangle className="size-7" /> : <Lock className="size-7" />}
        </div>
        <h2 className="share-shell-title">
          {isNotFound ? "Không tìm thấy" : "Không thể mở"}
        </h2>
        <p className="share-shell-desc">{reasonText(reason)}</p>
      </div>
      <style>{shareStyles}</style>
    </ShareLayout>
  );
}

function StatusBadge({ status, expiresAt }: { status: string; expiresAt: string | null }) {
  const isExpired = status === "expired" || (expiresAt && new Date(expiresAt) < new Date());
  if (status === "disabled") {
    return <span className="share-badge share-badge--off">Đã tắt</span>;
  }
  if (isExpired) {
    return <span className="share-badge share-badge--expired">Hết hạn</span>;
  }
  return <span className="share-badge share-badge--active">Đang mở</span>;
}

// ─── Field Row ────────────────────────────────────────────────

function FieldRow({
  label,
  value,
  copied,
  onCopy,
  sensitive,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
  sensitive?: boolean;
}) {
  const [revealed, setRevealed] = useState(!sensitive);
  const displayValue = sensitive && !revealed ? "•".repeat(Math.min(value.length, 16)) : value;

  return (
    <div className="share-field">
      <div className="share-field-meta">
        <span className="share-field-label">{label}</span>
        {sensitive && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            className="share-field-reveal"
          >
            {revealed ? "Ẩn" : "Hiện"}
          </button>
        )}
      </div>
      <div className="share-field-row">
        <span className={`share-field-value${sensitive && !revealed ? " share-field-value--hidden" : ""}${sensitive ? " share-field-value--mono" : ""}`}>
          {displayValue}
        </span>
        <button
          type="button"
          onClick={onCopy}
          className={`share-copy-btn${copied ? " share-copy-btn--done" : ""}`}
          title="Sao chép"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </button>
      </div>
    </div>
  );
}

// ─── TOTP Row ─────────────────────────────────────────────────

function TotpRow({
  slug,
  credential,
  copiedState,
  onCopy,
}: {
  slug: string;
  credential: ShareCredential;
  copiedState: string | null;
  onCopy: (value: string, id: string) => void;
}) {
  const [totp, setTotp] = useState<TotpState | null>(null);
  const totpCode = totp?.code;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function load() {
      const result = await fetchJson<TotpState>(`/api/share/${slug}/totp?credentialId=${encodeURIComponent(credential.id)}`);
      if (!cancelled && result.ok) {
        setTotp(result.data);
        timer = setTimeout(load, Math.max(1, result.data.remainingSeconds) * 1000);
      }
    }

    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [credential.id, slug]);

  useEffect(() => {
    if (!totpCode) return;
    const interval = setInterval(() => {
      setTotp((current) => current ? { ...current, remainingSeconds: Math.max(0, current.remainingSeconds - 1) } : current);
    }, 1000);
    return () => clearInterval(interval);
  }, [totpCode]);

  const isCopiedTotp = copiedState === credential.id;
  const isCopiedSecret = copiedState === `${credential.id}_secret`;
  const code = totp?.code ?? "------";
  const period = totp?.period ?? 30;
  const remaining = totp?.remainingSeconds ?? 0;
  const progress = Math.round((remaining / period) * 100);
  const isUrgent = remaining <= 5;

  return (
    <div className="share-totp">
      <div className="share-totp-header">
        <div>
          <span className="share-field-label">{credential.label}</span>
          <div className="share-totp-code">
            <span className={`share-totp-digits${isUrgent ? " share-totp-digits--urgent" : ""}`}>
              {code.slice(0, 3)} {code.slice(3)}
            </span>
            <div className="share-totp-timer" title={`${remaining}s còn lại`}>
              <svg className="share-totp-ring" viewBox="0 0 32 32">
                <circle cx="16" cy="16" r="13" className="share-totp-ring-bg" />
                <circle
                  cx="16"
                  cy="16"
                  r="13"
                  className={`share-totp-ring-fill${isUrgent ? " share-totp-ring-fill--urgent" : ""}`}
                  strokeDasharray={`${(progress / 100) * 81.68} 81.68`}
                  strokeDashoffset="0"
                  style={{ transition: "stroke-dasharray 1s linear" }}
                />
              </svg>
              <span className={`share-totp-secs${isUrgent ? " share-totp-secs--urgent" : ""}`}>{remaining}</span>
            </div>
          </div>
          <p className="share-totp-hint">
            {totp ? `Mã hết hạn sau ${remaining}s` : "Đang tạo mã..."}
          </p>
        </div>
        <button
          type="button"
          disabled={!totp}
          onClick={() => totp ? onCopy(totp.code, credential.id) : undefined}
          className={`share-copy-btn${isCopiedTotp ? " share-copy-btn--done" : ""}`}
          title="Sao chép mã 2FA"
        >
          {isCopiedTotp ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </button>
      </div>

      {credential.value ? (
        <div className="share-totp-secret">
          <span className="share-field-label share-field-label--small">Khóa gốc 2FA (Key Secret)</span>
          <div className="share-field-row">
            <code className="share-totp-secret-value">{credential.value}</code>
            <button
              type="button"
              onClick={() => onCopy(credential.value!, `${credential.id}_secret`)}
              className={`share-copy-btn${isCopiedSecret ? " share-copy-btn--done" : ""}`}
              title="Sao chép khóa 2FA"
            >
              {isCopiedSecret ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────

async function fetchJson<T>(url: string, init?: RequestInit): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const response = await fetch(url, { ...init, cache: "no-store", credentials: "include", headers });
  const responsePayload = await response.json().catch(() => null) as { data?: T; error?: string } | null;
  if (!response.ok || !responsePayload?.data) {
    return { ok: false, error: responsePayload?.error ?? "Yêu cầu không thành công" };
  }
  return { ok: true, data: responsePayload.data };
}

function reasonText(reason: string) {
  switch (reason) {
    case "expired_link": return "Liên kết chia sẻ đã hết hạn.";
    case "view_limit_reached": return "Liên kết chia sẻ đã hết lượt xem.";
    case "unlock_limit_reached": return "Liên kết chia sẻ đã hết lượt mở khóa.";
    case "inactive_link": return "Liên kết chia sẻ đã bị tắt.";
    default: return "Liên kết chia sẻ không còn khả dụng.";
  }
}

function formatExpiry(expiresAt: string) {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Đã hết hạn";
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  if (hours > 24) return `Hết hạn sau ${Math.floor(hours / 24)} ngày`;
  if (hours > 0) return `Hết hạn sau ${hours}h ${minutes}m`;
  return `Hết hạn sau ${minutes}m`;
}

// ─── Styles ───────────────────────────────────────────────────

const shareStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

  .share-root {
    min-height: 100vh;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem 1rem;
    position: relative;
    overflow: hidden;
    font-family: 'Inter', system-ui, sans-serif;
  }

  .share-bg-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    pointer-events: none;
  }

  .share-bg-orb-1 {
    width: 500px;
    height: 500px;
    background: radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%);
    top: -100px;
    right: -100px;
  }

  .share-bg-orb-2 {
    width: 400px;
    height: 400px;
    background: radial-gradient(circle, rgba(168,85,247,0.08) 0%, transparent 70%);
    bottom: -80px;
    left: -80px;
  }

  .share-container {
    width: 100%;
    max-width: 460px;
    position: relative;
    z-index: 1;
  }

  /* Card */
  .share-card {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.10);
    border-radius: 24px;
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    overflow: hidden;
    box-shadow:
      0 0 0 1px rgba(255,255,255,0.05) inset,
      0 32px 80px rgba(0,0,0,0.5),
      0 8px 32px rgba(0,0,0,0.3);
  }

  /* Header */
  .share-card-header {
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    background: rgba(255,255,255,0.02);
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .share-brand {
    display: flex;
    align-items: flex-start;
    gap: 0.875rem;
    min-width: 0;
  }

  .share-brand-icon {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 12px;
    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    flex-shrink: 0;
    box-shadow: 0 4px 12px rgba(59,130,246,0.4);
  }

  .share-brand-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(148,163,184,0.8);
    margin-bottom: 2px;
  }

  .share-title {
    font-size: 1rem;
    font-weight: 700;
    color: #f1f5f9;
    line-height: 1.3;
    word-break: break-word;
  }

  /* Badges */
  .share-badge {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 3px 10px;
    border-radius: 100px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .share-badge--active {
    background: rgba(16,185,129,0.15);
    color: #34d399;
    border: 1px solid rgba(16,185,129,0.25);
  }

  .share-badge--off {
    background: rgba(239,68,68,0.12);
    color: #f87171;
    border: 1px solid rgba(239,68,68,0.2);
  }

  .share-badge--expired {
    background: rgba(245,158,11,0.12);
    color: #fbbf24;
    border: 1px solid rgba(245,158,11,0.2);
  }

  /* Meta bar */
  .share-meta-bar {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.625rem 1.5rem;
    background: rgba(59,130,246,0.05);
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }

  .share-meta-item {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 11px;
    font-weight: 500;
    color: rgba(148,163,184,0.9);
  }

  /* Body */
  .share-card-body {
    padding: 1.25rem 1.5rem;
  }

  /* Lock Form */
  .share-lock-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .share-lock-notice {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: rgba(245,158,11,0.08);
    border: 1px solid rgba(245,158,11,0.2);
    border-radius: 12px;
    font-size: 12px;
    font-weight: 500;
    color: #fcd34d;
  }

  .share-input-group {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .share-input-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(148,163,184,0.7);
  }

  .share-input-wrapper {
    position: relative;
  }

  .share-input-icon {
    position: absolute;
    left: 0.875rem;
    top: 50%;
    transform: translateY(-50%);
    width: 1rem;
    height: 1rem;
    color: rgba(148,163,184,0.5);
    pointer-events: none;
  }

  .share-input {
    width: 100%;
    height: 2.75rem;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px;
    padding: 0 1rem 0 2.5rem;
    font-size: 14px;
    font-weight: 600;
    color: #f1f5f9;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
    font-family: inherit;
  }

  .share-input::placeholder {
    color: rgba(148,163,184,0.4);
    font-weight: 400;
  }

  .share-input:focus {
    border-color: rgba(59,130,246,0.5);
    box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
  }

  .share-error {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 12px;
    font-weight: 600;
    color: #f87171;
  }

  .share-unlock-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    height: 2.75rem;
    width: 100%;
    background: linear-gradient(135deg, #3b82f6, #2563eb);
    border: none;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 700;
    color: white;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.1s, box-shadow 0.15s;
    box-shadow: 0 4px 16px rgba(59,130,246,0.3);
    font-family: inherit;
  }

  .share-unlock-btn:hover:not(:disabled) {
    opacity: 0.92;
    box-shadow: 0 6px 20px rgba(59,130,246,0.4);
    transform: translateY(-1px);
  }

  .share-unlock-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .share-unlock-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Fields */
  .share-fields {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  .share-field {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 14px;
    padding: 0.875rem 1rem;
    transition: border-color 0.15s, background 0.15s;
  }

  .share-field:hover {
    background: rgba(255,255,255,0.05);
    border-color: rgba(255,255,255,0.12);
  }

  .share-field-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.375rem;
  }

  .share-field-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(148,163,184,0.65);
  }

  .share-field-label--small {
    font-size: 9px;
    letter-spacing: 0.1em;
  }

  .share-field-reveal {
    font-size: 10px;
    font-weight: 600;
    color: #60a5fa;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    font-family: inherit;
    transition: color 0.15s;
  }

  .share-field-reveal:hover {
    color: #93c5fd;
  }

  .share-field-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .share-field-value {
    flex: 1;
    min-width: 0;
    font-size: 14px;
    font-weight: 600;
    color: #e2e8f0;
    word-break: break-all;
    line-height: 1.4;
  }

  .share-field-value--hidden {
    letter-spacing: 0.15em;
    color: rgba(148,163,184,0.7);
  }

  .share-field-value--mono {
    font-family: 'Fira Code', monospace;
    font-size: 13px;
  }

  /* Copy button */
  .share-copy-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    flex-shrink: 0;
    border-radius: 8px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.08);
    color: rgba(148,163,184,0.7);
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }

  .share-copy-btn:hover:not(:disabled) {
    background: rgba(59,130,246,0.15);
    color: #60a5fa;
    border-color: rgba(59,130,246,0.3);
  }

  .share-copy-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .share-copy-btn--done {
    background: rgba(16,185,129,0.15) !important;
    color: #34d399 !important;
    border-color: rgba(16,185,129,0.3) !important;
  }

  /* Loading inline */
  .share-loading-inline {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.625rem;
    padding: 2rem 0;
    font-size: 13px;
    font-weight: 500;
    color: rgba(148,163,184,0.6);
  }

  /* TOTP */
  .share-totp {
    background: rgba(16,185,129,0.05);
    border: 1px solid rgba(16,185,129,0.18);
    border-radius: 14px;
    padding: 1rem;
  }

  .share-totp-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .share-totp-code {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin: 0.375rem 0;
  }

  .share-totp-digits {
    font-size: 1.75rem;
    font-weight: 800;
    color: #f1f5f9;
    letter-spacing: 0.25em;
    font-family: 'Fira Code', monospace;
    line-height: 1;
  }

  .share-totp-digits--urgent {
    color: #fb923c;
    animation: pulse 0.8s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.65; }
  }

  .share-totp-timer {
    position: relative;
    width: 2rem;
    height: 2rem;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .share-totp-ring {
    width: 2rem;
    height: 2rem;
    transform: rotate(-90deg);
    position: absolute;
    top: 0;
    left: 0;
  }

  .share-totp-ring-bg {
    fill: none;
    stroke: rgba(255,255,255,0.08);
    stroke-width: 3;
  }

  .share-totp-ring-fill {
    fill: none;
    stroke: #34d399;
    stroke-width: 3;
    stroke-linecap: round;
  }

  .share-totp-ring-fill--urgent {
    stroke: #fb923c;
  }

  .share-totp-secs {
    font-size: 9px;
    font-weight: 800;
    color: #34d399;
    position: relative;
    z-index: 1;
    line-height: 1;
  }

  .share-totp-secs--urgent {
    color: #fb923c;
  }

  .share-totp-hint {
    font-size: 11px;
    font-weight: 500;
    color: rgba(52,211,153,0.7);
  }

  .share-totp-secret {
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid rgba(16,185,129,0.12);
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .share-totp-secret-value {
    flex: 1;
    min-width: 0;
    font-size: 11px;
    font-family: 'Fira Code', monospace;
    font-weight: 600;
    color: rgba(226,232,240,0.8);
    word-break: break-all;
  }

  /* Footer */
  .share-card-footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    padding: 0.75rem 1.5rem;
    border-top: 1px solid rgba(255,255,255,0.04);
    background: rgba(255,255,255,0.01);
    font-size: 10px;
    font-weight: 500;
    color: rgba(100,116,139,0.7);
    letter-spacing: 0.02em;
    text-align: center;
  }

  /* Shell (Error / Loading) */
  .share-shell {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 24px;
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    padding: 2.5rem;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  .share-shell-icon {
    width: 3.5rem;
    height: 3.5rem;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 0.25rem;
  }

  .share-shell-icon--loading {
    background: rgba(59,130,246,0.12);
    color: #60a5fa;
    border: 1px solid rgba(59,130,246,0.2);
  }

  .share-shell-icon--error {
    background: rgba(239,68,68,0.1);
    color: #f87171;
    border: 1px solid rgba(239,68,68,0.2);
  }

  .share-shell-icon--warn {
    background: rgba(245,158,11,0.1);
    color: #fbbf24;
    border: 1px solid rgba(245,158,11,0.2);
  }

  .share-shell-title {
    font-size: 1.25rem;
    font-weight: 800;
    color: #f1f5f9;
  }

  .share-shell-desc {
    font-size: 13px;
    font-weight: 400;
    color: rgba(148,163,184,0.8);
    max-width: 280px;
    line-height: 1.6;
  }
`;
