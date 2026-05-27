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
      default: "border border-[var(--border-soft)] bg-[rgba(255,255,255,0.9)] text-[var(--fg-base)] shadow-sm hover:border-[var(--border-strong)] hover:bg-white",
      primary: "border border-transparent bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] text-white shadow-[0_16px_30px_rgba(var(--accent-rgb),0.2)] hover:shadow-[0_20px_36px_rgba(var(--accent-rgb),0.28)]",
      secondary: "border border-[var(--border-soft)] bg-[var(--surface-light)] text-[var(--fg-base)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-strong)]",
      danger: "border border-transparent bg-[var(--danger)] text-white shadow-[0_12px_24px_rgba(220,38,38,0.16)] hover:bg-[#b91c1c]",
      ghost: "border border-transparent text-[var(--fg-base)] hover:bg-[var(--surface-light)] hover:text-[var(--fg-base)]",
      link: "border border-transparent px-0 py-0 text-[var(--accent)] underline-offset-4 hover:underline",
    };

    const sizes = {
      default: "h-10 px-4 py-2",
      sm: "h-9 px-3 text-xs",
      lg: "h-12 px-6",
      icon: "h-10 w-10 p-2",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-[1rem] font-semibold tracking-tight transition-[background-color,border-color,box-shadow,color,opacity] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      >
        {isLoading ? <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button };
