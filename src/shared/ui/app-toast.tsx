"use client";

import type { CSSProperties } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Info,
  Loader2,
  Sparkles,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import "./app-toast.css";

type ToastVariant = "success" | "error" | "warning" | "info" | "loading";

interface AppToastOptions {
  description?: string;
  action?: { label: string; onClick: () => void };
  showProgress?: boolean;
  customIcon?: LucideIcon;
  duration?: number;
  className?: string;
  id?: string | number;
  style?: CSSProperties;
  onAutoClose?: (t: string | number) => void;
  onDismiss?: (t: string | number) => void;
}

const VARIANT_ICONS: Record<ToastVariant, LucideIcon> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
  loading: Loader2,
};

const VARIANT_DURATION: Record<ToastVariant, number> = {
  success: 3000,
  error: 5000,
  warning: 4000,
  info: 3500,
  loading: Infinity,
};

const pendingDismissals = new Set<string | number>();

export function preloadAppToast() {
  return;
}

function createToastId(id?: string | number) {
  if (id !== undefined) {
    return id;
  }

  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `app-toast-${crypto.randomUUID()}`;
  }

  return `app-toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function renderToast(variant: ToastVariant, message: string, opts?: AppToastOptions) {
  const toastId = createToastId(opts?.id);
  const IconComponent = opts?.customIcon ?? VARIANT_ICONS[variant];
  const duration = opts?.duration ?? VARIANT_DURATION[variant];
  const isLoading = variant === "loading";

  if (pendingDismissals.has(toastId)) {
    pendingDismissals.delete(toastId);
    return toastId;
  }

  toast.custom(
    (id) => (
      <div className="app-toast-content" role="alert">
        <div className={`app-toast-icon app-toast-icon--${variant}`}>
          <IconComponent className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
        </div>
        <div className="app-toast-text">
          <p className="app-toast-title">{message}</p>
          {opts?.description ? <p className="app-toast-desc">{opts.description}</p> : null}
          {opts?.action ? (
            <button
              className="app-toast-action"
              onClick={() => {
                opts.action?.onClick();
                toast.dismiss(id);
              }}
            >
              {opts.action.label}
            </button>
          ) : null}
        </div>
        {opts?.showProgress && duration !== Infinity ? (
          <div className="app-toast-progress">
            <div
              className={`app-toast-progress-bar app-toast-progress-bar--${variant}`}
              style={{ animation: `toast-progress ${duration}ms linear forwards` }}
            />
          </div>
        ) : null}
      </div>
    ),
    {
      duration,
      className: opts?.className,
      unstyled: false,
      id: toastId,
      style: opts?.style,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onAutoClose: opts?.onAutoClose as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onDismiss: opts?.onDismiss as any,
    },
  );

  return toastId;
}

export const appToast = {
  success(message: string, opts?: AppToastOptions) {
    return renderToast("success", message, opts);
  },

  error(message: string, opts?: AppToastOptions) {
    return renderToast("error", message, { showProgress: true, ...opts });
  },

  warning(message: string, opts?: AppToastOptions) {
    return renderToast("warning", message, opts);
  },

  info(message: string, opts?: AppToastOptions) {
    return renderToast("info", message, opts);
  },

  loading(message: string, opts?: AppToastOptions) {
    return renderToast("loading", message, opts);
  },

  promise<T>(
    promise: Promise<T>,
    msgs: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((err: unknown) => string);
    },
  ) {
    toast.promise(promise, {
      loading: msgs.loading,
      success: (data) =>
        typeof msgs.success === "function" ? msgs.success(data) : msgs.success,
      error: (err) =>
        typeof msgs.error === "function" ? msgs.error(err) : msgs.error,
    });

    return promise;
  },

  async copy(text: string, label?: string) {
    let success = false;

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        success = true;
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
          success = document.execCommand("copy");
        } catch {
          success = false;
        }

        document.body.removeChild(textArea);
      }
    } catch {
      success = false;
    }

    if (success) {
      return renderToast("success", label ?? "Đã copy!", {
        description: text.length > 50 ? `${text.slice(0, 47)}...` : text,
        duration: 2000,
        customIcon: Copy,
      });
    }

    return renderToast("error", "Không thể copy", {
      description: "Vui lòng copy thủ công",
      duration: 2000,
    });
  },

  feature(message: string, opts?: AppToastOptions) {
    return renderToast("info", message, { customIcon: Sparkles, ...opts });
  },

  dismiss(id?: string | number) {
    if (id !== undefined) {
      pendingDismissals.add(id);
    }

    if (id !== undefined) {
      pendingDismissals.delete(id);
      toast.dismiss(id);
      return;
    }

    toast.dismiss();
  },
};
