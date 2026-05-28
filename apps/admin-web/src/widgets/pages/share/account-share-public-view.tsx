"use client";

import { useCallback, useEffect, useState, useTransition, type FormEvent } from "react";
import { Check, Copy, KeyRound, Loader2, Lock, ShieldCheck } from "lucide-react";

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
    return <Shell title="Đang tải" subtitle="Đang kiểm tra liên kết chia sẻ..." />;
  }

  if (!summary || summary.status === "not_found") {
    return <Shell title="Không tìm thấy" subtitle="Liên kết chia sẻ không tồn tại hoặc đã bị thu hồi." />;
  }

  if (summary.reason && summary.reason !== "locked") {
    return <Shell title="Không thể mở" subtitle={reasonText(summary.reason)} />;
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#f7fbf4,#eef7ff)] px-4 py-8 text-slate-950">
      <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-3xl place-items-center">
        <div className="w-full overflow-hidden rounded-[24px] border border-white/80 bg-white/90 shadow-[0_24px_70px_rgba(15,23,42,0.12)] backdrop-blur">
          <div className="border-b border-slate-100 bg-[linear-gradient(180deg,#ffffff,#f7faf6)] px-5 py-5 sm:px-7">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-lime-100 text-lime-700">
                <ShieldCheck className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Chia sẻ tài khoản</p>
                <h1 className="truncate text-xl font-black tracking-tight text-slate-950">
                  {summary.title || payload?.title || "Thông tin tài khoản"}
                </h1>
              </div>
            </div>
          </div>

          <div className="px-5 py-5 sm:px-7">
            {summary.locked ? (
              <form onSubmit={handleUnlock} className="space-y-4">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-medium text-amber-800">
                  Liên kết này cần mã mở khóa trước khi hiển thị thông tin.
                </div>
                <label className="block space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Mã mở khóa</span>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={passcode}
                      onChange={(event) => setPasscode(event.target.value)}
                      type="password"
                      autoComplete="one-time-code"
                      className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-3 text-[14px] font-bold outline-none transition focus:border-lime-500 focus:ring-4 focus:ring-lime-100"
                    />
                  </div>
                </label>
                {error ? <p className="text-[13px] font-semibold text-red-600">{error}</p> : null}
                <button
                  type="submit"
                  disabled={pending}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-[14px] font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {pending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                  Mở khóa
                </button>
              </form>
            ) : payload ? (
              <div className="space-y-3">
                {payload.email ? (
                  <FieldRow label="Tài khoản" value={payload.email} copied={copied === "email"} onCopy={() => copyValue(payload.email!, "email")} />
                ) : null}
                {payload.password ? (
                  <FieldRow label="Mật khẩu" value={payload.password} copied={copied === "password"} onCopy={() => copyValue(payload.password!, "password")} sensitive />
                ) : null}
                {payload.credentials.map((credential) => (
                  credential.totpAvailable ? (
                    <TotpRow key={credential.id} slug={slug} credential={credential} onCopy={copyValue} copiedState={copied} />
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
                ))}
                {payload.remainingViews !== null ? (
                  <p className="pt-2 text-center text-[11px] font-semibold text-slate-500">
                    Còn {payload.remainingViews} lượt xem.
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="flex items-center justify-center py-8 text-[13px] font-medium text-slate-500">
                <Loader2 className="mr-2 size-4 animate-spin" />
                Đang tải thông tin...
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function Shell({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[linear-gradient(135deg,#f7fbf4,#eef7ff)] px-4 text-center text-slate-950">
      <div className="max-w-md rounded-[24px] border border-white/80 bg-white/90 p-8 shadow-[0_24px_70px_rgba(15,23,42,0.12)]">
        <ShieldCheck className="mx-auto mb-4 size-10 text-lime-700" />
        <h1 className="text-2xl font-black tracking-tight">{title}</h1>
        <p className="mt-2 text-[14px] font-medium text-slate-600">{subtitle}</p>
      </div>
    </main>
  );
}

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
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
        <p className={`mt-1 break-all text-[14px] font-black text-slate-950 ${sensitive ? "font-mono" : ""}`}>{value}</p>
      </div>
      <button
        type="button"
        onClick={onCopy}
        className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm transition hover:text-lime-700"
        title="Sao chép"
      >
        {copied ? <Check className="size-4 text-lime-700" /> : <Copy className="size-4" />}
      </button>
    </div>
  );
}

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
  const value = totp?.code ?? "------";

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-lime-200 bg-lime-50 px-4 py-4">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-lime-700">{credential.label}</p>
          <p className="mt-1 font-mono text-[22px] font-black tracking-[0.2em] text-slate-950">{value}</p>
          <p className="text-[11px] font-semibold text-lime-700">{totp ? `${totp.remainingSeconds}s` : "Đang tạo mã"}</p>
        </div>
        <button
          type="button"
          disabled={!totp}
          onClick={() => totp ? onCopy(totp.code, credential.id) : undefined}
          className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm transition hover:text-lime-700 disabled:opacity-50"
          title="Sao chép mã 2FA nhanh"
        >
          {isCopiedTotp ? <Check className="size-4 text-lime-700" /> : <Copy className="size-4" />}
        </button>
      </div>

      {credential.value ? (
        <div className="mt-2.5 border-t border-lime-200/60 pt-2.5">
          <p className="text-[10px] font-black uppercase tracking-widest text-lime-700">Khóa thiết lập 2FA gốc (Key Secret)</p>
          <div className="mt-1.5 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-xl bg-white px-3 py-2 text-[12px] font-mono font-bold text-slate-800">
              {credential.value}
            </code>
            <button
              type="button"
              onClick={() => onCopy(credential.value!, `${credential.id}_secret`)}
              className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm transition hover:text-lime-700"
              title="Sao chép khóa thiết lập 2FA"
            >
              {isCopiedSecret ? <Check className="size-4 text-lime-700" /> : <Copy className="size-4" />}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    credentials: "include",
    headers,
  });
  const responsePayload = await response.json().catch(() => null) as { data?: T; error?: string } | null;
  if (!response.ok || !responsePayload?.data) {
    return { ok: false, error: responsePayload?.error ?? "Yêu cầu không thành công" };
  }
  return { ok: true, data: responsePayload.data };
}

function reasonText(reason: string) {
  switch (reason) {
    case "expired_link":
      return "Liên kết chia sẻ đã hết hạn.";
    case "view_limit_reached":
      return "Liên kết chia sẻ đã hết lượt xem.";
    case "unlock_limit_reached":
      return "Liên kết chia sẻ đã hết lượt mở khóa.";
    case "inactive_link":
      return "Liên kết chia sẻ đã bị tắt.";
    default:
      return "Liên kết chia sẻ không còn khả dụng.";
  }
}
