import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
  variant?: "default" | "primary" | "secondary" | "danger" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", isLoading, children, disabled, ...props }, ref) => {
    const variants = {
      default: "border border-[var(--border-soft)] bg-white/70 backdrop-blur-sm text-[var(--fg-base)] shadow-sm hover:border-[var(--border-strong)] hover:bg-white/95",
      primary: "border border-transparent bg-gradient-to-br from-[#5ec918] to-[#3a8b05] text-white shadow-[0_6px_16px_rgba(79,190,10,0.18)] hover:from-[#6ad722] hover:to-[#419d06] hover:shadow-[0_8px_20px_rgba(79,190,10,0.28)]",
      secondary: "border border-[var(--border-soft)] bg-[var(--surface-light)]/70 backdrop-blur-sm text-[var(--fg-base)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]",
      danger: "border border-transparent bg-gradient-to-br from-[#ef4444] to-[#b91c1c] text-white shadow-[0_6px_16px_rgba(220,38,38,0.12)] hover:from-[#f87171] hover:to-[#dc2626] hover:shadow-[0_8px_20px_rgba(220,38,38,0.2)]",
      ghost: "border border-transparent text-[var(--fg-base)] hover:bg-[var(--surface-light)] hover:text-[var(--fg-base)]",
      link: "border border-transparent px-0 py-0 text-[var(--accent)] underline-offset-4 hover:underline",
    };

    const sizes = {
      default: "h-[38px] px-3.5 py-1.5 text-xs sm:text-sm",
      sm: "h-[32px] px-2.5 text-[11px] sm:text-xs",
      lg: "h-[44px] px-5 text-sm sm:text-base",
      icon: "h-[36px] w-[36px] p-1.5",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-2xl font-bold tracking-tight transition-[background-color,border-color,box-shadow,color,opacity,transform] duration-200 ease-out active:scale-[0.97] active:duration-75 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      >
        {isLoading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button };
