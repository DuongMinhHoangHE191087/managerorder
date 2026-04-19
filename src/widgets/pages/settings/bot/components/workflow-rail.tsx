"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type WorkflowRailStepStatus = "done" | "active" | "pending" | "warning";

export interface WorkflowRailStep {
  title: string;
  description?: string;
  badge?: string;
  status?: WorkflowRailStepStatus;
  icon?: ReactNode;
}

interface WorkflowRailProps {
  title: string;
  description?: string;
  steps: WorkflowRailStep[];
  className?: string;
}

const statusClasses: Record<WorkflowRailStepStatus, string> = {
  done: "border-emerald-200 bg-emerald-50/80 text-emerald-700",
  active: "border-[var(--accent)]/20 bg-[linear-gradient(135deg,rgba(var(--accent-rgb),0.12),rgba(255,255,255,0.94))] text-[var(--accent)]",
  pending: "border-[var(--border-soft)] bg-[rgba(255,255,255,0.9)] text-[var(--fg-base)]",
  warning: "border-amber-200 bg-amber-50/80 text-amber-700",
};

export function WorkflowRail({
  title,
  description,
  steps,
  className,
}: WorkflowRailProps) {
  return (
    <section className={cn("app-card overflow-hidden", className)}>
      <header className="flex flex-col gap-2 border-b border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,244,0.84))] px-5 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="inline-flex rounded-full bg-[var(--accent)]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
            Workflow
          </span>
          <h2 className="text-[15px] font-bold tracking-tight text-[var(--fg-base)]">{title}</h2>
        </div>
        {description ? <p className="text-[13px] text-[var(--fg-muted)]">{description}</p> : null}
      </header>

      <div className="grid gap-3 p-4 sm:grid-cols-2">
        {steps.map((step, index) => {
          const status = step.status ?? "pending";

          return (
            <article
              key={`${step.title}-${index}`}
              className={cn(
                "rounded-[1.2rem] border p-4 transition-all",
                statusClasses[status],
              )}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex size-9 items-center justify-center rounded-[0.9rem] bg-white/80 text-[var(--fg-base)] shadow-sm">
                    {step.icon ?? <span className="text-[12px] font-black">{index + 1}</span>}
                  </span>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-70">
                      Step {index + 1}
                    </p>
                    <p className="text-[13px] font-bold tracking-tight">{step.title}</p>
                  </div>
                </div>
                {step.badge ? (
                  <span className="rounded-full border border-current/15 bg-white/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">
                    {step.badge}
                  </span>
                ) : null}
              </div>
              {step.description ? (
                <p className="text-[12px] font-medium leading-5 opacity-90">{step.description}</p>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
