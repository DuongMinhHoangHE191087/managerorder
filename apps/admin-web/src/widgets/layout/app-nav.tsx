"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { memo, type ComponentType, useMemo, useState } from "react";
import {
  Activity,
  Bell,
  Bot,
  Boxes,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  Link2,
  Menu,
  Package,
  Search,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { vi } from "@/shared/messages/vi";
import { RuntimeStatusChip } from "@/widgets/layout/runtime-status-chip";

const LazyNavUserMenu = dynamic(
  () => import("./nav-user-menu").then((module) => ({ default: module.NavUserMenu })),
  { ssr: false, loading: () => <NavUserMenuFallback /> },
);
const LazyNotificationsDrawer = dynamic(
  () => import("./notifications-drawer").then((module) => ({ default: module.NotificationsDrawer })),
  { ssr: false, loading: () => null },
);

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    label: vi.navigation.sections.operations,
    items: [
      { href: "/dashboard", label: vi.navigation.items.dashboard, icon: LayoutDashboard },
      { href: "/orders", label: vi.navigation.items.orders, icon: ShoppingCart },
      { href: "/inventory", label: vi.navigation.items.inventory, icon: Boxes },
      { href: "/customers", label: vi.navigation.items.customers, icon: Users },
      { href: "/providers", label: vi.navigation.items.providers, icon: ShieldCheck },
      { href: "/products", label: vi.navigation.items.products, icon: Package },
    ],
  },
  {
    label: vi.navigation.sections.premiumAccounts,
    items: [
      { href: "/premium/accounts", label: vi.navigation.items.premiumAccounts, icon: Package },
      { href: "/premium/health-checks", label: "Sức khỏe", icon: Activity },
      { href: "/premium/subscriptions", label: vi.navigation.items.subscriptions, icon: ClipboardList },
      { href: "/premium/services", label: vi.navigation.items.services, icon: Settings2 },
      { href: "/premium/renewals", label: vi.navigation.items.renewals, icon: CalendarDays },
      { href: "/premium/migrations", label: vi.navigation.items.migrations, icon: ChevronRight },
    ],
  },
  {
    label: vi.navigation.sections.utilities,
    items: [
      { href: "/calendar", label: vi.navigation.items.calendar, icon: CalendarDays },
      { href: "/activity-logs", label: vi.navigation.items.activityLogs, icon: ClipboardList },
      { href: "/short-links", label: vi.navigation.items.shortLinks, icon: Link2 },
      { href: "/trash", label: vi.navigation.items.trash, icon: Trash2 },
      { href: "/settings", label: vi.navigation.items.settings, icon: Settings2 },
      { href: "/settings/bot", label: vi.navigation.items.botManagement, icon: Bot },
    ],
  },
];

function NavUserMenuFallback() {
  return (
    <div className="flex items-center gap-2 rounded-xl px-2 py-1">
      <div className="size-8 animate-pulse rounded-full bg-[var(--border-soft)]" />
      <div className="hidden h-4 w-24 animate-pulse rounded-full bg-[var(--border-soft)] sm:block" />
    </div>
  );
}

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-3">
      <div className="flex size-11 items-center justify-center rounded-[1.1rem] bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] text-white shadow-[0_14px_28px_rgba(var(--accent-rgb),0.22)]">
        <span className="text-lg font-black tracking-tight">DM</span>
      </div>
      <div className="min-w-0">
        <p className="truncate text-[15px] font-black tracking-tight text-[var(--fg-base)]">
          {vi.navigation.brand.title}
        </p>
        <p className="truncate text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--fg-muted)]">
          {vi.navigation.brand.subtitle}
        </p>
      </div>
    </Link>
  );
}

const SidebarContent = memo(function SidebarContent({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--border-soft)] px-5 py-5">
        <Brand />
        <RuntimeStatusChip />
      </div>

      <div className="custom-scrollbar flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-5">
          {navSections.map((section) => (
            <div key={section.label}>
              <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">
                {section.label}
              </p>
              <nav className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-3 rounded-[1rem] px-3 py-2.5 text-[13px] font-semibold transition-all",
                        isActive
                          ? "border border-[var(--accent)]/15 bg-[linear-gradient(135deg,rgba(var(--accent-rgb),0.12),rgba(255,255,255,0.92))] text-[var(--accent)] shadow-[0_10px_24px_rgba(var(--accent-rgb),0.12)]"
                          : "border border-transparent text-[var(--fg-muted)] hover:border-[var(--border-soft)] hover:bg-[rgba(255,255,255,0.7)] hover:text-[var(--fg-base)]",
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-[var(--border-soft)] px-4 py-4">
        <Link
          href="/orders/new"
          onClick={onNavigate}
          className="flex w-full items-center justify-center gap-2 rounded-[1rem] bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] px-4 py-3 text-[13px] font-bold text-white shadow-[0_16px_30px_rgba(var(--accent-rgb),0.2)] transition-all hover:shadow-[0_20px_36px_rgba(var(--accent-rgb),0.28)]"
        >
          <ShoppingCart className="size-4" />
          {vi.navigation.actions.createOrder}
        </Link>
      </div>
    </div>
  );
});

function dispatchCommandPalette(eventName: "app:command-palette:open" | "app:command-palette:toggle") {
  window.dispatchEvent(new Event(eventName));
}

export function AppNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);

  const currentLabel = useMemo(() => {
    for (const section of navSections) {
      for (const item of section.items) {
        if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
          return item.label;
        }
      }
    }

    return vi.navigation.actions.defaultCurrent;
  }, [pathname]);

  return (
    <>
      <aside className="hidden border-r border-[var(--border-soft)] bg-[rgba(255,255,255,0.78)] backdrop-blur-2xl lg:sticky lg:top-0 lg:row-span-2 lg:flex lg:h-screen lg:flex-col lg:shadow-[0_18px_48px_rgba(15,23,42,0.05)]">
        <SidebarContent pathname={pathname} />
      </aside>

      <header
        className="sticky top-0 flex h-16 items-center gap-2 border-b border-[var(--border-soft)] bg-[rgba(255,255,255,0.82)] px-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)] backdrop-blur-2xl sm:gap-3 sm:px-6 lg:col-start-2 lg:px-8"
        style={{ zIndex: "var(--z-header)" }}
      >
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="inline-flex size-10 items-center justify-center rounded-[1rem] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.84)] text-[var(--fg-base)] transition-all hover:bg-white lg:hidden"
          aria-label={vi.navigation.actions.openNavigation}
        >
          <Menu className="size-5" />
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">
            {vi.navigation.brand.subtitle}
          </p>
          <p className="truncate text-[15px] font-bold tracking-tight text-[var(--fg-base)]">
            {currentLabel}
          </p>
        </div>

        <button
          type="button"
          onClick={() => dispatchCommandPalette("app:command-palette:open")}
          className="hidden items-center gap-3 rounded-[1rem] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.8)] px-4 py-2 text-left transition-all hover:border-[var(--accent)]/25 hover:bg-white/90 hover:shadow-sm xl:flex"
        >
          <Search className="size-4 text-[var(--fg-muted)]" />
          <span className="text-sm font-semibold text-[var(--fg-base)]">{vi.navigation.actions.quickSearch}</span>
          <span className="rounded-md border border-[var(--border-soft)] bg-[var(--bg-surface)] px-2 py-0.5 text-[11px] font-bold text-[var(--fg-muted)]">
            Ctrl K
          </span>
        </button>

        <button
          type="button"
          onClick={() => dispatchCommandPalette("app:command-palette:open")}
          className="inline-flex size-10 items-center justify-center rounded-[1rem] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.84)] text-[var(--fg-muted)] transition-all hover:bg-white hover:text-[var(--fg-base)] xl:hidden"
          aria-label={vi.navigation.actions.openQuickSearch}
        >
          <Search className="size-4" />
        </button>

        <button
          type="button"
          onClick={() => setNotificationsOpen(true)}
          className="relative inline-flex size-10 items-center justify-center rounded-[1rem] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.84)] text-[var(--fg-muted)] transition-all hover:bg-white hover:text-[var(--fg-base)]"
          aria-label={vi.navigation.actions.notifications}
          aria-expanded={notificationsOpen}
        >
          <Bell className="size-5" />
          {notificationCount > 0 ? (
            <span className="absolute right-1.5 top-1.5 inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-black leading-5 text-white">
              {notificationCount > 9 ? "9+" : notificationCount}
            </span>
          ) : null}
        </button>

        <LazyNavUserMenu />
      </header>

      <LazyNotificationsDrawer
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        onCountChange={setNotificationCount}
      />

      {mobileOpen ? (
        <div className="fixed inset-0 lg:hidden" style={{ zIndex: "var(--z-drawer)" }}>
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-label={vi.navigation.actions.closeNavigation}
          />
          <aside className="relative h-full w-[86vw] max-w-[320px] border-r border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] shadow-[0_24px_60px_rgba(15,23,42,0.16)] backdrop-blur-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-5 py-4">
              <Brand />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="inline-flex size-9 items-center justify-center rounded-[0.9rem] border border-[var(--border-soft)] text-[var(--fg-base)] transition-colors hover:bg-[var(--surface-light)]"
                aria-label={vi.navigation.actions.closeNavigation}
              >
                <X className="size-4" />
              </button>
            </div>
            <SidebarContent pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}
    </>
  );
}
