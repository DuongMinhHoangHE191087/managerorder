import { type ReactNode, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface CreateFlowShellProps {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
  scrollBody?: boolean;
}

export function CreateFlowShell({
  title,
  description,
  children,
  footer,
  className,
  contentClassName,
  scrollBody = false,
}: CreateFlowShellProps) {
  return (
    <div className={cn("flex flex-col overflow-hidden rounded-[28px] border border-[var(--border-soft)] bg-white shadow-xl shadow-slate-900/5", className)}>
      <header className="border-b border-[var(--border-soft)] px-5 py-4 sm:px-6">
        <h2 className="text-xl font-black tracking-tight text-[var(--fg-base)]">{title}</h2>
        {description ? (
          <p className="mt-1 max-w-3xl text-sm font-medium leading-6 text-[var(--fg-muted)]">{description}</p>
        ) : null}
      </header>
      <div
        className={cn(
          "grid gap-5 p-5 sm:p-6",
          scrollBody ? "min-h-0 flex-1 overflow-y-auto" : undefined,
          contentClassName,
        )}
      >
        {children}
      </div>
      {footer ? (
        <div className="sticky bottom-0 z-10 border-t border-[var(--border-soft)] bg-white/92 px-5 py-4 backdrop-blur sm:px-6">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

interface CreateFormSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function CreateFormSection({ title, description, children, className }: CreateFormSectionProps) {
  return (
    <section className={cn("rounded-3xl border border-[var(--border-soft)] bg-[var(--surface-light)]/45", className)}>
      <div className="border-b border-[var(--border-soft)] px-5 py-4">
        <h3 className="text-base font-black text-[var(--fg-base)]">{title}</h3>
        {description ? <p className="mt-1 text-sm font-medium leading-6 text-[var(--fg-muted)]">{description}</p> : null}
      </div>
      <div className="grid gap-4 p-5">{children}</div>
    </section>
  );
}

interface CreateActionFooterProps {
  primaryLabel: string;
  onPrimary: () => void;
  onCancel?: () => void;
  cancelLabel?: string;
  pending?: boolean;
  disabled?: boolean;
}

export function CreateActionFooter({
  primaryLabel,
  onPrimary,
  onCancel,
  cancelLabel = "Hủy",
  pending = false,
  disabled = false,
}: CreateActionFooterProps) {
  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
      {onCancel ? (
        <button
          type="button"
          onClick={onCancel}
          className="rounded-2xl border border-[var(--border-soft)] bg-white px-5 py-3 text-sm font-black text-[var(--fg-muted)] transition-colors hover:text-[var(--fg-base)]"
        >
          {cancelLabel}
        </button>
      ) : null}
      <button
        type="button"
        onClick={onPrimary}
        disabled={disabled || pending}
        className="rounded-2xl bg-[var(--accent)] px-6 py-3 text-sm font-black text-white shadow-lg shadow-emerald-700/15 transition-all hover:-translate-y-0.5 hover:opacity-95 disabled:translate-y-0 disabled:opacity-45"
      >
        {pending ? "Đang lưu..." : primaryLabel}
      </button>
    </div>
  );
}

interface AdvancedOptionsDisclosureProps {
  title?: string;
  children: ReactNode;
}

export function AdvancedOptionsDisclosure({ title = "Tùy chọn nâng cao", children }: AdvancedOptionsDisclosureProps) {
  return (
    <details className="group rounded-3xl border border-dashed border-[var(--border-soft)] bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-black text-[var(--fg-base)]">
        {title}
        <ChevronDown className="size-4 text-[var(--fg-muted)] transition-transform group-open:rotate-180" />
      </summary>
      <div className="grid gap-4 border-t border-[var(--border-soft)] p-5">{children}</div>
    </details>
  );
}

const DIALOG_WIDTH: Record<NonNullable<CreateFlowDialogProps["size"]>, string> = {
  md: "max-w-2xl",
  lg: "max-w-3xl",
  xl: "max-w-4xl",
  "2xl": "max-w-5xl",
};

interface CreateFlowDialogProps extends Omit<CreateFlowShellProps, "className"> {
  isOpen: boolean;
  onClose: () => void;
  size?: "md" | "lg" | "xl" | "2xl";
  panelClassName?: string;
}

export function CreateFlowDialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = "lg",
  panelClassName,
  contentClassName,
  scrollBody = true,
}: CreateFlowDialogProps) {
  useDialogLock(isOpen, onClose);

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          role="dialog"
          aria-modal="true"
          data-testid="create-flow-dialog"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: "rgba(15,23,42,0.45)", backdropFilter: "blur(4px)" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 14 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            className={cn("flex max-h-[92vh] w-full flex-col", DIALOG_WIDTH[size], panelClassName)}
            onClick={(event) => event.stopPropagation()}
          >
            <CreateFlowShell
              title={title}
              description={description}
              footer={footer}
              scrollBody={scrollBody}
              className="max-h-[92vh]"
              contentClassName={contentClassName}
            >
              {children}
            </CreateFlowShell>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

interface CreateSurfaceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: "md" | "lg" | "xl" | "2xl";
  panelClassName?: string;
}

function useDialogLock(isOpen: boolean, onClose: () => void) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEsc);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);
}

export function CreateSurfaceDialog({
  isOpen,
  onClose,
  children,
  size = "xl",
  panelClassName,
}: CreateSurfaceDialogProps) {
  useDialogLock(isOpen, onClose);

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          role="dialog"
          aria-modal="true"
          data-testid="create-surface-dialog"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: "rgba(15,23,42,0.45)", backdropFilter: "blur(4px)" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 14 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            className={cn("flex max-h-[92vh] w-full flex-col overflow-y-auto", DIALOG_WIDTH[size], panelClassName)}
            onClick={(event) => event.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
