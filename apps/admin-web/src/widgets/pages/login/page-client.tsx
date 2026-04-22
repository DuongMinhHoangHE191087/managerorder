"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Globe, LogIn, Mail, Shield } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { CONTACTS, getAuthErrorMessage } from "@/widgets/marketing/sales-landing-config";

type AuthTab = "email" | "google";

const LoginEmailPanel = dynamic(
  () =>
    import("@/widgets/pages/login/components/login-email-panel").then((mod) => ({
      default: mod.LoginEmailPanel,
    })),
  {
    ssr: false,
    loading: () => <AuthPanelSkeleton />,
  },
);

const LoginGooglePanel = dynamic(
  () =>
    import("@/widgets/pages/login/components/login-google-panel").then((mod) => ({
      default: mod.LoginGooglePanel,
    })),
  {
    ssr: false,
    loading: () => <AuthPanelSkeleton />,
  },
);

function AuthPanelSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-11 animate-pulse rounded-xl bg-[var(--border-soft)]/70" />
      <div className="h-11 animate-pulse rounded-xl bg-[var(--border-soft)]/70" />
      <div className="h-12 animate-pulse rounded-2xl bg-[var(--border-soft)]/70" />
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AuthTab>("email");
  const [error, setError] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/dashboard";
  const authError = searchParams.get("error");
  const authReason = searchParams.get("reason");
  const displayError = error || getAuthErrorMessage(authError, authReason);
  const retryUrl = redirectUrl === "/dashboard"
    ? "/login"
    : `/login?redirect=${encodeURIComponent(redirectUrl)}`;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--bg-app)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[var(--accent)]/5 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-[var(--accent)]/8 blur-3xl" />
        <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent)]/3 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-4 w-full max-w-md">
        <div className="glass-card-strong p-8 sm:p-10">
          <div className="mb-6 flex justify-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-[var(--accent)] shadow-[0_8px_32px_rgba(85,202,2,0.3)]">
              <Globe className="size-8 text-white" />
            </div>
          </div>

          <div className="text-center">
            <h1 className="mb-2 text-2xl font-bold tracking-tight text-[var(--fg-base)]">
              Duong Minh Hoang
            </h1>
            <p className="mb-6 text-sm text-[var(--fg-muted)]">
      Đăng nhập để truy cập hệ thống quản lý
            </p>
          </div>

          <div className="mb-6 flex gap-1 rounded-2xl bg-[var(--border-soft)]/50 p-1">
            <button
              type="button"
              onClick={() => {
                setActiveTab("email");
                setError(null);
              }}
              className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all duration-200 ${
                activeTab === "email"
                  ? "bg-[var(--bg-surface)] text-[var(--fg-base)] shadow-sm"
                  : "text-[var(--fg-muted)] hover:text-[var(--fg-base)]"
              }`}
            >
              <Mail className="size-4" />
              Email
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("google");
                setError(null);
              }}
              className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all duration-200 ${
                activeTab === "google"
                  ? "bg-[var(--bg-surface)] text-[var(--fg-base)] shadow-sm"
                  : "text-[var(--fg-muted)] hover:text-[var(--fg-base)]"
              }`}
            >
              <svg className="size-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Google
            </button>
          </div>

          {displayError && (
            <AuthErrorPanel
              message={displayError}
              onRetry={() => {
                setError(null);
                router.replace(retryUrl);
              }}
            />
          )}

          {activeTab === "email" ? (
            <LoginEmailPanel redirectUrl={redirectUrl} onErrorChange={setError} />
          ) : (
            <LoginGooglePanel redirectUrl={redirectUrl} onErrorChange={setError} />
          )}

          <div className="mt-8 flex flex-col items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-[var(--fg-muted)]">
              <Shield className="size-3" />
              <span>Bao mat boi ma hoa end-to-end</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[var(--fg-muted)]">
              <LogIn className="size-3" />
              <span>Chi tai khoan duoc cap quyen moi co the truy cap</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AuthErrorPanel({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="mb-4 overflow-hidden rounded-3xl border border-amber-200/70 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-4 shadow-[0_14px_40px_rgba(251,146,60,0.12)]">
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-amber-200/60">
          <svg className="size-5 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
            <path d="M10.3 4.4 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3l-7.5-12.6a2 2 0 0 0-3.4 0Z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-slate-900">Xác thực chưa hoàn tất</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">{message}</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-800"
            >
              Thử lại
            </button>
            <a
              href={CONTACTS.zaloPersonal}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-xl border border-amber-200 bg-white px-4 py-2.5 text-sm font-bold text-amber-700 transition-colors hover:border-amber-300 hover:text-amber-800"
            >
              Nhắn Zalo hỗ trợ
            </a>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:border-blue-500 hover:text-slate-900"
            >
              Quay về đăng nhập
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
