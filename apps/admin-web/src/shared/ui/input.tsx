import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          "flex h-10 w-full rounded-[1rem] border bg-[rgba(255,255,255,0.88)] px-3 py-2 text-[13px] font-medium text-[var(--fg-base)] shadow-sm transition-[background-color,border-color,box-shadow,color,opacity] file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[var(--fg-muted)]/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
          error
            ? "border-[var(--danger)] focus-visible:border-[var(--danger)] focus-visible:ring-[var(--danger)]/50"
            : "border-[var(--border-soft)] focus-visible:border-[var(--accent)] focus-visible:ring-[var(--ring)] hover:border-[var(--border-strong)]",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
