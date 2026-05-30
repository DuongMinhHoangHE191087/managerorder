import type { ReactNode } from "react";

interface SectionCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}

export function SectionCard({
  title,
  description: _description,
  children,
  action,
}: SectionCardProps) {
  return (
    <section className="app-card flex flex-col overflow-hidden">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(246,250,244,0.78))] px-5 py-4 sm:px-6">
        <div>
          <h2 className="text-[15px] font-bold tracking-tight text-[var(--fg-base)]">{title}</h2>
        </div>
        {action}
      </header>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}
