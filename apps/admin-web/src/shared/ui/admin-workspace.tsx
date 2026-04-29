import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SurfaceCard } from "@/shared/ui/page-layout";

interface WorkspaceHeroProps {
  title: string;
  description?: string;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
}

interface WorkspaceGridProps {
  children: ReactNode;
  className?: string;
}

interface WorkspacePaneProps {
  children: ReactNode;
  className?: string;
}

interface WorkspaceMetricCardProps {
  label: string;
  value: ReactNode;
  description?: string;
  tone?: "default" | "accent" | "danger" | "warning";
  icon?: ReactNode;
  className?: string;
}

interface WorkspaceToolbarProps {
  children: ReactNode;
  className?: string;
}

interface ToolbarFieldProps {
  label?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

interface KeyValueListProps {
  items: Array<{
    label: string;
    value: ReactNode;
    hint?: ReactNode;
  }>;
  className?: string;
}

const TONE_CLASSES: Record<NonNullable<WorkspaceMetricCardProps["tone"]>, string> = {
  default: "border-[var(--border-soft)] bg-white/90",
  accent: "border-[var(--accent)]/20 bg-[linear-gradient(135deg,rgba(var(--accent-rgb),0.12),rgba(255,255,255,0.96))]",
  danger: "border-red-200 bg-[linear-gradient(135deg,rgba(239,68,68,0.08),rgba(255,255,255,0.96))]",
  warning: "border-amber-200 bg-[linear-gradient(135deg,rgba(245,158,11,0.12),rgba(255,255,255,0.96))]",
};

export function WorkspaceHero({
  title,
  description,
  eyebrow,
  actions,
  meta,
  className,
}: WorkspaceHeroProps) {
  return (
    <SurfaceCard
      className={cn(
        "overflow-visible border border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,250,244,0.88))]",
        className,
      )}
    >
      <div className="flex flex-col gap-6 px-5 py-5 sm:px-6 lg:px-7 lg:py-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 space-y-3">
            {eyebrow ? (
              <div className="flex flex-wrap items-center gap-2 text-[12px] font-bold uppercase tracking-[0.28em] text-[var(--accent)]">
                {eyebrow}
              </div>
            ) : null}
            <div className="space-y-2">
              <h1 className="text-[2rem] font-black tracking-tight text-[var(--fg-base)] sm:text-[2.2rem]">
                {title}
              </h1>
              {description ? (
                <p className="max-w-4xl text-[14px] font-medium leading-6 text-[var(--fg-muted)] sm:text-[15px]">
                  {description}
                </p>
              ) : null}
            </div>
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
        </div>
        {meta ? <div className="flex flex-wrap items-stretch gap-3">{meta}</div> : null}
      </div>
    </SurfaceCard>
  );
}

export function WorkspaceGrid({ children, className }: WorkspaceGridProps) {
  return (
    <div
      className={cn(
        "grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.85fr)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function WorkspaceMain({ children, className }: WorkspacePaneProps) {
  return <div className={cn("space-y-5", className)}>{children}</div>;
}

export function WorkspaceAside({ children, className }: WorkspacePaneProps) {
  return <aside className={cn("space-y-5", className)}>{children}</aside>;
}

export function WorkspaceMetricCard({
  label,
  value,
  description,
  tone = "default",
  icon,
  className,
}: WorkspaceMetricCardProps) {
  return (
    <div
      className={cn(
        "min-w-[160px] flex-1 rounded-[22px] border px-4 py-4 shadow-[0_10px_26px_rgba(15,23,42,0.05)]",
        TONE_CLASSES[tone],
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--fg-muted)]">
            {label}
          </p>
          <div className="mt-2 text-[1.7rem] font-black leading-none tracking-tight text-[var(--fg-base)]">
            {value}
          </div>
        </div>
        {icon ? (
          <div className="flex size-10 items-center justify-center rounded-2xl bg-white/70 text-[var(--accent)] shadow-sm">
            {icon}
          </div>
        ) : null}
      </div>
      {description ? (
        <p className="mt-3 text-[12px] font-medium leading-5 text-[var(--fg-muted)]">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function WorkspaceToolbar({ children, className }: WorkspaceToolbarProps) {
  return (
    <SurfaceCard
      className={cn(
        "overflow-visible border border-[var(--border-soft)] bg-[rgba(255,255,255,0.92)]",
        className,
      )}
    >
      <div className="grid gap-4 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:items-end">
        {children}
      </div>
    </SurfaceCard>
  );
}

export function ToolbarField({
  label,
  description,
  children,
  className,
}: ToolbarFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {label ? (
        <div className="space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--fg-muted)]">
            {label}
          </p>
          {description ? (
            <p className="text-[12px] font-medium leading-5 text-[var(--fg-muted)]">
              {description}
            </p>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function KeyValueList({ items, className }: KeyValueListProps) {
  return (
    <dl className={cn("space-y-3", className)}>
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-[20px] border border-[var(--border-soft)] bg-white/80 px-4 py-3"
        >
          <dt className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--fg-muted)]">
            {item.label}
          </dt>
          <dd className="mt-1 text-[14px] font-semibold text-[var(--fg-base)]">{item.value}</dd>
          {item.hint ? (
            <div className="mt-1 text-[12px] font-medium leading-5 text-[var(--fg-muted)]">
              {item.hint}
            </div>
          ) : null}
        </div>
      ))}
    </dl>
  );
}
