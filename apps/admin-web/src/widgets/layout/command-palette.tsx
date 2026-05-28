"use client";

import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  Boxes,
  Calendar,
  LayoutDashboard,
  Loader2,
  Package,
  Search,
  ShieldCheck,
  ShoppingCart,
  Star,
  Users,
} from "lucide-react";
import { readApiEnvelope } from "@/shared/lib/api-client";
import { vi } from "@/shared/messages/vi";
import type { ShellSearchResult } from "@/shared/types/shell";

interface CommandPaletteProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

type ShortcutItem = {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: typeof LayoutDashboard;
};

const shortcuts: ShortcutItem[] = [
  {
    id: "dashboard",
    label: vi.navigation.items.dashboard,
    description: vi.commandPalette.shortcutDescriptions.dashboard,
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    id: "orders-new",
    label: vi.navigation.actions.createOrder,
    description: vi.commandPalette.shortcutDescriptions.createOrder,
    href: "/orders/new",
    icon: ShoppingCart,
  },
  {
    id: "orders",
    label: vi.navigation.items.orders,
    description: vi.commandPalette.shortcutDescriptions.orders,
    href: "/orders",
    icon: ShoppingCart,
  },
  {
    id: "customers",
    label: vi.navigation.items.customers,
    description: vi.commandPalette.shortcutDescriptions.customers,
    href: "/customers",
    icon: Users,
  },
  {
    id: "inventory",
    label: vi.navigation.items.inventory,
    description: vi.commandPalette.shortcutDescriptions.inventory,
    href: "/inventory",
    icon: Boxes,
  },
  {
    id: "providers",
    label: vi.navigation.items.providers,
    description: vi.commandPalette.shortcutDescriptions.providers,
    href: "/providers",
    icon: ShieldCheck,
  },
  {
    id: "premium-accounts",
    label: vi.navigation.items.premiumAccounts,
    description: vi.commandPalette.shortcutDescriptions.premiumAccounts,
    href: "/premium/accounts",
    icon: Package,
  },
  {
    id: "calendar",
    label: vi.navigation.items.calendar,
    description: vi.commandPalette.shortcutDescriptions.calendar,
    href: "/calendar",
    icon: Calendar,
  },
];

function getResultIcon(kind: ShellSearchResult["kind"]) {
  switch (kind) {
    case "order":
      return ShoppingCart;
    case "customer":
      return Users;
    case "source_account":
      return Boxes;
    case "premium_account":
      return Package;
    default:
      return Star;
  }
}

export function CommandPalette({ isOpen, onOpenChange }: CommandPaletteProps) {
  const [open, setOpen] = useState(isOpen);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ShellSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const router = useRouter();
  const deferredQuery = useDeferredValue(query.trim());

  useEffect(() => {
    setOpen(isOpen);
  }, [isOpen]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setIsSearching(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        onOpenChange(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (deferredQuery.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(
          `/api/search/global?q=${encodeURIComponent(deferredQuery)}`,
          {
            credentials: "same-origin",
            signal: controller.signal,
          },
        );
        const payload = await readApiEnvelope<ShellSearchResult[]>(response);

        startTransition(() => {
          setResults(response.ok ? payload.data ?? [] : []);
        });
      } catch {
        if (!controller.signal.aborted) {
          startTransition(() => setResults([]));
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [deferredQuery, open]);

  const filteredShortcuts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return shortcuts;
    }

    return shortcuts.filter((item) =>
      [item.label, item.description].some((value) =>
        value.toLowerCase().includes(normalized),
      ),
    );
  }, [query]);

  const closePalette = () => {
    setOpen(false);
    onOpenChange(false);
  };

  const runCommand = (command: () => void) => {
    closePalette();
    command();
  };

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 flex items-start justify-center bg-black/38 px-4 pb-8 pt-[12vh] backdrop-blur-sm"
      style={{ zIndex: "var(--z-command-palette)" }}
      onClick={closePalette}
    >
      <div
        className="overlay-surface w-full max-w-2xl overflow-hidden rounded-[28px]"
        onClick={(event) => event.stopPropagation()}
      >
        <Command label={vi.commandPalette.title} shouldFilter={false}>
          <div className="flex items-center gap-3 border-b border-[var(--border-soft)] px-4 sm:px-5">
            <Search className="size-5 text-[var(--fg-muted)]" />
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder={vi.commandPalette.placeholder}
              className="h-16 flex-1 border-none bg-transparent text-[15px] text-[var(--fg-base)] outline-none placeholder:text-[var(--fg-muted)]"
            />
            <div className="flex items-center gap-2">
              {isSearching ? (
                <Loader2 className="size-4 animate-spin text-[var(--accent)]" />
              ) : null}
              <button
                className="rounded-md border border-[var(--border-soft)] bg-[var(--surface-strong)] px-2 py-1 text-[10px] font-bold text-[var(--fg-muted)]"
                onClick={closePalette}
              >
                ESC
              </button>
            </div>
          </div>

          <Command.List className="custom-scrollbar max-h-[32rem] overflow-y-auto p-2 sm:p-3">
            {filteredShortcuts.length > 0 ? (
              <Command.Group
                heading={vi.commandPalette.shortcutsHeading}
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.18em] [&_[cmdk-group-heading]]:text-[var(--fg-muted)]"
              >
                {filteredShortcuts.map((item) => {
                  const Icon = item.icon;

                  return (
                    <Command.Item
                      key={item.id}
                      value={item.label}
                      onSelect={() => runCommand(() => router.push(item.href))}
                      className="flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-3 text-[13px] font-medium text-[var(--fg-base)] aria-selected:bg-[var(--accent)]/8 aria-selected:text-[var(--accent)]"
                    >
                      <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--surface-light)]">
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{item.label}</p>
                        <p className="truncate text-[12px] text-[var(--fg-muted)]">
                          {item.description}
                        </p>
                      </div>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            ) : null}

            {query.trim().length >= 2 ? (
              <>
                <Command.Separator className="mx-2 my-2 h-px bg-[var(--border-soft)]" />
                <Command.Group
                  heading={vi.commandPalette.searchResultsHeading}
                  className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.18em] [&_[cmdk-group-heading]]:text-[var(--fg-muted)]"
                >
                  {results.length > 0 ? (
                    results.map((item) => {
                      const Icon = getResultIcon(item.kind);
                      return (
                        <Command.Item
                          key={`${item.kind}-${item.id}`}
                          value={`${item.title} ${item.subtitle ?? ""}`}
                          onSelect={() => runCommand(() => router.push(item.href))}
                          className="flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-3 text-[13px] font-medium text-[var(--fg-base)] aria-selected:bg-[var(--accent)]/8 aria-selected:text-[var(--accent)]"
                        >
                          <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--surface-light)]">
                            <Icon className="size-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-bold">{item.title}</p>
                              <span className="rounded-full bg-[var(--surface-light)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--fg-muted)]">
                                {item.kind === "order"
                                  ? vi.commandPalette.kinds.order
                                  : item.kind === "customer"
                                    ? vi.commandPalette.kinds.customer
                                    : item.kind === "source_account"
                                      ? vi.commandPalette.kinds.sourceAccount
                                      : item.kind === "premium_account"
                                        ? vi.commandPalette.kinds.premiumAccount
                                        : vi.commandPalette.kinds.fallback}
                              </span>
                            </div>
                            <p className="truncate text-[12px] text-[var(--fg-muted)]">
                              {item.subtitle ?? item.meta ?? vi.commandPalette.metaFallback}
                            </p>
                          </div>
                        </Command.Item>
                      );
                    })
                  ) : (
                    <div className="px-3 py-8 text-center text-[13px] text-[var(--fg-muted)]">
                      {isSearching ? vi.commandPalette.loading : vi.commandPalette.noResults}
                    </div>
                  )}
                </Command.Group>
              </>
            ) : null}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
