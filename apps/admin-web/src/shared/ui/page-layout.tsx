import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
  variant?: "wide" | "narrow";
}

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  className?: string;
}

interface SurfaceCardProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  className?: string;
  tone?: "default" | "muted";
}

interface StatsGridProps {
  children: ReactNode;
  className?: string;
  density?: "default" | "dense";
}

interface FiltersBarProps {
  children: ReactNode;
  className?: string;
  sticky?: boolean;
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

interface DetailSidebarProps {
  children: ReactNode;
  className?: string;
}

export function PageContainer({
  children,
  className,
  variant = "wide",
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "page-container page-stack",
        variant === "wide" ? "page-container--wide" : "page-container--narrow",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "app-card flex min-w-0 max-w-full flex-col gap-5 border border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,244,0.86))] px-5 py-5 shadow-[0_18px_44px_rgba(15,23,42,0.05)] sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-7 lg:py-6",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[13px] font-bold text-[var(--accent)]">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="break-words text-2xl font-black tracking-tight text-[var(--fg-base)] lg:text-[2.15rem]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-3xl text-sm font-medium text-[var(--fg-muted)] lg:text-[15px]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex min-w-0 flex-wrap items-center gap-3">{actions}</div> : null}
    </header>
  );
}

export function SurfaceCard({
  children,
  className,
  tone = "default",
  ...rest
}: SurfaceCardProps) {
  return (
    <section
      {...rest}
      className={cn(
        "min-w-0 max-w-full overflow-hidden rounded-[28px] border border-[var(--border-soft)] shadow-[0_18px_44px_rgba(15,23,42,0.05)]",
        tone === "default"
          ? "bg-[rgba(255,255,255,0.92)]"
          : "bg-[rgba(246,250,244,0.88)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function StatsGrid({
  children,
  className,
  density = "default",
}: StatsGridProps) {
  return (
    <div
      className={cn(
        "grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4",
        density === "dense" && "xl:grid-cols-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function FiltersBar({
  children,
  className,
  sticky = false,
}: FiltersBarProps) {
  return <section className={cn("filters-bar", sticky && "filters-bar--sticky", className)}>{children}</section>;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("empty-state", className)}>
      {icon ? (
        <div className="rounded-full border border-[var(--border-soft)] bg-white/80 p-3 text-[var(--fg-muted)] shadow-sm">
          {icon}
        </div>
      ) : null}
      <div className="space-y-1">
        <h3 className="text-[15px] font-bold text-[var(--fg-base)]">{title}</h3>
        {description ? <p className="text-[13px] text-[var(--fg-muted)]">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  action,
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-3 border-b border-[var(--border-soft)] px-4 py-4 sm:px-5 md:flex-row md:items-center md:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="break-words text-[15px] font-bold tracking-tight text-[var(--fg-base)]">{title}</h2>
        {description ? <p className="mt-1 break-words text-[13px] text-[var(--fg-muted)]">{description}</p> : null}
      </div>
      {action ? <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function DetailSidebar({ children, className }: DetailSidebarProps) {
  return <aside className={cn("detail-sidebar", className)}>{children}</aside>;
}
