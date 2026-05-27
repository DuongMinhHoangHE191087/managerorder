"use client";

import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAuthStore } from "@/lib/stores/auth-store";

type LoginFieldErrors = {
  email?: string;
  password?: string;
};

type LoginEmailPanelProps = {
  redirectUrl: string;
  onErrorChange: (error: string | null) => void;
};

function validateLoginFields(email: string, password: string): LoginFieldErrors {
  const nextErrors: LoginFieldErrors = {};
  const normalizedEmail = email.trim();

  if (!normalizedEmail) {
    nextErrors.email = "Vui long nhap email";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    nextErrors.email = "Email khong hop le";
  }

  if (!password.trim()) {
    nextErrors.password = "Vui long nhap mat khau";
  }

  return nextErrors;
}

export function LoginEmailPanel({ redirectUrl, onErrorChange }: LoginEmailPanelProps) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<LoginFieldErrors>({});
  const { loginWithEmail, isLoading } = useAuthStore();

  const handleEmailLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onErrorChange(null);
    const nextErrors = validateLoginFields(email, password);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    try {
      await loginWithEmail(email.trim(), password);
      router.push(redirectUrl);
    } catch (error) {
    onErrorChange(error instanceof Error ? error.message : "Đăng nhập thất bại");
    }
  };

  return (
    <form onSubmit={handleEmailLogin} className="space-y-4" noValidate>
      <div>
        <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-[var(--fg-muted)]">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="admin@example.com"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setErrors((current) => ({ ...current, email: undefined }));
          }}
          className={`w-full rounded-xl border bg-[var(--border-soft)]/50 px-4 py-3 text-sm text-[var(--fg-base)] outline-none transition-[background-color,border-color,box-shadow,color,opacity,transform,width] duration-200 placeholder:text-[var(--fg-muted)]/50 focus:ring-2 focus:ring-[var(--accent)]/30 ${
            errors.email
              ? "border-[var(--danger)]/50 focus:border-[var(--danger)]"
              : "border-transparent focus:border-[var(--accent)]/50"
          }`}
        />
        {errors.email && <p className="mt-1 text-xs text-[var(--danger)]">{errors.email}</p>}
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-[var(--fg-muted)]">
          Mat khau
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="........"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setErrors((current) => ({ ...current, password: undefined }));
            }}
            className={`w-full rounded-xl border bg-[var(--border-soft)]/50 px-4 py-3 pr-12 text-sm text-[var(--fg-base)] outline-none transition-[background-color,border-color,box-shadow,color,opacity,transform,width] duration-200 placeholder:text-[var(--fg-muted)]/50 focus:ring-2 focus:ring-[var(--accent)]/30 ${
              errors.password
                ? "border-[var(--danger)]/50 focus:border-[var(--danger)]"
                : "border-transparent focus:border-[var(--accent)]/50"
            }`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-[var(--fg-muted)] transition-colors hover:text-[var(--fg-base)]"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {errors.password && <p className="mt-1 text-xs text-[var(--danger)]">{errors.password}</p>}
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(85,202,2,0.3)] transition-[background-color,border-color,box-shadow,color,opacity,transform,width] duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? (
          <div className="size-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        ) : (
          <>
            <ArrowRight className="size-4" />
      <span>Đăng nhập</span>
          </>
        )}
      </button>
    </form>
  );
}
