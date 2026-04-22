import * as React from "react";
import { cn } from "@/lib/utils";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, style, ...props }, ref) => {
    const mergedStyle = {
      backgroundImage:
        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
      backgroundRepeat: "no-repeat",
      backgroundPosition: "right 0.85rem center",
      backgroundSize: "12px",
      ...style,
    };

    return (
      <select
        ref={ref}
        className={cn(
          "flex h-10 w-full cursor-pointer appearance-none rounded-[1rem] border bg-[rgba(255,255,255,0.88)] px-3 py-2 pr-9 text-[13px] font-medium text-[var(--fg-base)] shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
          error
            ? "border-[var(--danger)] focus-visible:border-[var(--danger)] focus-visible:ring-[var(--danger)]/50"
            : "border-[var(--border-soft)] focus-visible:border-[var(--accent)] focus-visible:ring-[var(--ring)] hover:border-[var(--border-strong)]",
          className,
        )}
        style={mergedStyle}
        {...props}
      />
    );
  },
);
Select.displayName = "Select";

export { Select };
