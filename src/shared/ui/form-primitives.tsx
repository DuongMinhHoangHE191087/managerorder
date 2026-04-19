"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface FormSectionProps {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

interface FieldLabelProps {
  children: ReactNode;
  icon?: ReactNode;
  required?: boolean;
  className?: string;
}

interface ChoiceCardProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  title: string;
  description?: string;
  icon?: ReactNode;
}

interface ChoiceGridProps {
  children: ReactNode;
  className?: string;
}

export function FormSection({
  title,
  description,
  action,
  children,
  className,
}: FormSectionProps) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-[28px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] shadow-[0_18px_44px_rgba(15,23,42,0.05)]",
        className,
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,244,0.84))] px-5 py-4 sm:px-6">
        <div>
          <h2 className="text-[15px] font-bold tracking-tight text-[var(--fg-base)]">{title}</h2>
          {description ? (
            <p className="mt-1 text-[13px] font-medium text-[var(--fg-muted)]">
              {description}
            </p>
          ) : null}
        </div>
        {action}
      </header>
      <div className="space-y-6 px-5 py-5 sm:px-6">{children}</div>
    </section>
  );
}

export function FieldLabel({
  children,
  icon,
  required,
  className,
}: FieldLabelProps) {
  return (
    <label
      className={cn(
        "mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]",
        className,
      )}
    >
      {icon}
      <span>{children}</span>
      {required ? <span className="text-[var(--danger)]">*</span> : null}
    </label>
  );
}

export function ChoiceGrid({ children, className }: ChoiceGridProps) {
  return <div className={cn("grid gap-3", className)}>{children}</div>;
}

export function ChoiceCard({
  selected,
  title,
  description,
  icon,
  className,
  type = "button",
  ...props
}: ChoiceCardProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        "flex min-h-[4.75rem] w-full items-start gap-3 rounded-[1.25rem] border px-4 py-3 text-left transition-all",
        selected
          ? "border-[var(--accent)] bg-[linear-gradient(135deg,rgba(var(--accent-rgb),0.12),rgba(255,255,255,0.94))] text-[var(--accent)] shadow-[0_12px_30px_rgba(var(--accent-rgb),0.1)]"
          : "border-[var(--border-soft)] bg-[rgba(255,255,255,0.92)] text-[var(--fg-base)] hover:border-[var(--accent)]/35 hover:bg-[var(--surface-light)]",
        className,
      )}
      {...props}
    >
      {icon ? (
        <span
          className={cn(
            "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[0.9rem]",
            selected ? "bg-[var(--accent)]/12 text-[var(--accent)]" : "bg-[var(--surface-light)] text-[var(--fg-muted)]",
          )}
        >
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-3">
          <span className="truncate text-[13px] font-bold leading-tight">{title}</span>
          {selected ? <Check className="size-4 shrink-0 text-[var(--accent)]" /> : null}
        </span>
        {description ? (
          <span className="mt-1 block text-[11px] font-medium leading-snug text-[var(--fg-muted)]">
            {description}
          </span>
        ) : null}
      </span>
    </button>
  );
}
