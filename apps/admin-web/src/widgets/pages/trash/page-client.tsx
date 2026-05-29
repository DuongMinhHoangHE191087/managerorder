"use client";

import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import NextLink from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowDownUp,
  Clock3,
  Home,
  Eye,
  Info,
  KeyRound,
  Link as LinkIcon,
  Mail,
  Package,
  RotateCcw,
  Search,
  ShoppingCart,
  Trash2,
  Truck,
  Users,
} from "lucide-react";
import { AppLayout } from "@/widgets/layout/app-layout";
import { vi } from "@/shared/messages/vi";
import { cn, formatDateLabel, formatMoney } from "@/lib/utils";
import { hasSearchTokens, matchesSearchQuery } from "@/shared/lib/filtering/search";
import { Button } from "@/shared/ui/button";
import { DataTable } from "@/shared/ui/data-table";
import { Input } from "@/shared/ui/input";
import { Modal } from "@/shared/ui/modal";
import { SoftDeletedBadge } from "@/shared/ui/soft-deleted-badge";
import {
  KeyValueList,
  ToolbarField,
  WorkspaceMetricCard,
  WorkspaceToolbar,
} from "@/shared/ui/admin-workspace";
import {
  EmptyState,
  PageContainer,
  PageHeader,
  SectionHeader,
  SurfaceCard,
} from "@/shared/ui/page-layout";
import { ActionMenu } from "@/shared/ui/action-menu";
import { TRASH_COPY as copy } from "./copy";
import {
  usePurgeItems,
  useRestoreItems,
  useTrashCounts,
  useTrashItems,
} from "@/widgets/pages/trash/hooks/use-trash";

type EntityType =
  | "customers"
  | "orders"
  | "products"
  | "providers"
  | "source_accounts"
  | "license_keys"
  | "short_links"
  | "reminder_events"
  | "premium_accounts"
  | "subscription_renewals"
  | "account_migrations"
  | "account_share_links";

type TrashRecord = Record<string, unknown> & {
  id: string;
  deleted_at?: string | null;
  deleted_by?: string | null;
};

interface EntityConfig {
  label: string;
  icon: typeof Users;
  summary: Array<{
    label: string;
    keys: string[];
    kind?: "text" | "money" | "date" | "badge";
  }>;
}

const ENTITY_CONFIG: Record<EntityType, EntityConfig> = {
  customers: {
    label: copy.tabs.customers,
    icon: Users,
    summary: [
      { label: copy.fields.customers.fullName, keys: ["full_name", "name"] },
      { label: copy.fields.customers.type, keys: ["type"], kind: "badge" },
      { label: copy.fields.customers.notes, keys: ["notes"] },
    ],
  },
  orders: {
    label: copy.tabs.orders,
    icon: ShoppingCart,
    summary: [
      { label: copy.fields.orders.orderCode, keys: ["order_code"] },
      { label: copy.fields.orders.status, keys: ["status"], kind: "badge" },
      { label: copy.fields.orders.totalAmount, keys: ["total_amount_vnd"], kind: "money" },
    ],
  },
  products: {
    label: copy.tabs.products,
    icon: Package,
    summary: [
      { label: copy.fields.products.name, keys: ["name"] },
      { label: copy.fields.products.mode, keys: ["mode"], kind: "badge" },
      { label: copy.fields.products.price, keys: ["sell_price_vnd", "price_vnd"], kind: "money" },
    ],
  },
  providers: {
    label: copy.tabs.providers,
    icon: Truck,
    summary: [
      { label: copy.fields.providers.name, keys: ["name"] },
      { label: copy.fields.providers.tier, keys: ["tier"], kind: "badge" },
      { label: copy.fields.providers.contactEmail, keys: ["contact_email", "email"] },
    ],
  },
  source_accounts: {
    label: copy.tabs.sourceAccounts,
    icon: Mail,
    summary: [
      { label: copy.fields.sourceAccounts.email, keys: ["email"] },
      { label: copy.fields.sourceAccounts.provider, keys: ["provider"], kind: "badge" },
      { label: copy.fields.sourceAccounts.status, keys: ["status"], kind: "badge" },
    ],
  },
  license_keys: {
    label: copy.tabs.licenseKeys,
    icon: KeyRound,
    summary: [
      { label: copy.fields.licenseKeys.keyCode, keys: ["key_code"] },
      { label: copy.fields.licenseKeys.status, keys: ["status"], kind: "badge" },
      { label: copy.fields.licenseKeys.productId, keys: ["product_id"] },
    ],
  },
  short_links: {
    label: copy.tabs.shortLinks,
    icon: LinkIcon,
    summary: [
      { label: copy.fields.shortLinks.slug, keys: ["slug"] },
      { label: copy.fields.shortLinks.targetUrl, keys: ["target_url"] },
      { label: copy.fields.shortLinks.currentClicks, keys: ["current_clicks"], kind: "badge" },
    ],
  },
  reminder_events: {
    label: "Sự kiện lịch",
    icon: Clock3,
    summary: [
      { label: "Tiêu đề", keys: ["title"] },
      { label: "Loại sự kiện", keys: ["type"], kind: "badge" },
      { label: "Ngày đến hạn", keys: ["due_at"], kind: "date" },
    ],
  },
  premium_accounts: {
    label: "Tài khoản thuê bao",
    icon: Users,
    summary: [
      { label: "Email chính", keys: ["primary_email", "email"] },
      { label: "Trạng thái", keys: ["status"], kind: "badge" },
      { label: "Ngày hết hạn", keys: ["subscription_expiry_date"], kind: "date" },
    ],
  },
  subscription_renewals: {
    label: "Gia hạn thuê bao",
    icon: RotateCcw,
    summary: [
      { label: "ID gia hạn", keys: ["id"] },
      { label: "Trạng thái", keys: ["status"], kind: "badge" },
      { label: "Ngày yêu cầu", keys: ["created_at"], kind: "date" },
    ],
  },
  account_migrations: {
    label: "Chuyển đổi thuê bao",
    icon: ArrowDownUp,
    summary: [
      { label: "ID chuyển đổi", keys: ["id"] },
      { label: "Trạng thái", keys: ["status"], kind: "badge" },
      { label: "Ngày bắt đầu", keys: ["started_at"], kind: "date" },
    ],
  },
  account_share_links: {
    label: "Chia sẻ tài khoản",
    icon: LinkIcon,
    summary: [
      { label: "Tiêu đề", keys: ["title"] },
      { label: "Trạng thái", keys: ["status"], kind: "badge" },
      { label: "Đường dẫn (slug)", keys: ["slug"] },
    ],
  },
};

function resolveFieldValue(record: TrashRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return null;
}

function formatFieldValue(kind: EntityConfig["summary"][number]["kind"], value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (kind === "money") {
    const amount = Number(value);
    return Number.isFinite(amount) ? formatMoney(amount) : String(value);
  }

  if (kind === "date") {
    return typeof value === "string" ? formatDateLabel(value) : String(value);
  }

  if (Array.isArray(value)) {
    return value.length === 0 ? "—" : value.join(", ");
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function renderBadge(value: unknown) {
  const label = String(value ?? "—");
  const normalized = label.toLowerCase();
  const tone =
    normalized.includes("active") ||
    normalized.includes("completed") ||
    normalized.includes("retail") ||
    normalized.includes("vip")
      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/15"
      : normalized.includes("pending") ||
          normalized.includes("processing") ||
          normalized.includes("wholesale") ||
          normalized.includes("agency")
        ? "bg-amber-500/10 text-amber-700 border-amber-500/15"
        : normalized.includes("cancel") ||
            normalized.includes("expired") ||
            normalized.includes("failed")
          ? "bg-red-500/10 text-red-600 border-red-500/15"
          : "bg-slate-500/10 text-slate-600 border-slate-500/15";

  return (
    <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em]", tone)}>
      {label}
    </span>
  );
}

function buildPreviewItems(type: EntityType, record: TrashRecord) {
  return ENTITY_CONFIG[type].summary.map((field) => ({
    label: field.label,
    value: formatFieldValue(field.kind, resolveFieldValue(record, field.keys)),
  }));
}

function getTrashDetailHref(type: EntityType, item: TrashRecord) {
  const id = encodeURIComponent(item.id);

  switch (type) {
    case "customers":
      return `/customers/${id}?trash=1`;
    case "orders":
      return `/orders/${id}?trash=1`;
    case "products":
      return `/products?view=${id}&trash=1`;
    case "providers":
      return `/providers/${id}?trash=1`;
    case "source_accounts":
      return `/inventory/source-accounts/${id}?trash=1`;
    case "short_links":
      return `/short-links/${id}?trash=1`;
    case "license_keys":
      return `/inventory?key=${id}&trash=1`;
    case "reminder_events":
      return `/calendar?event=${id}&trash=1`;
    case "premium_accounts":
      return `/premium/accounts/${id}?trash=1`;
    case "subscription_renewals":
      return `/premium/renewals?id=${id}&trash=1`;
    case "account_migrations":
      return `/premium/migrations?id=${id}&trash=1`;
    case "account_share_links":
      return `/account-shares?id=${id}&trash=1`;
    default:
      return "/";
  }
}

function parseTrashType(value: string | null): EntityType | null {
  if (!value || !(value in ENTITY_CONFIG)) {
    return null;
  }

  return value as EntityType;
}

function getDeletedAgo(value: unknown) {
  if (!value || typeof value !== "string") {
    return "—";
  }

  const distance = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(distance / 60000);
  if (minutes < 60) {
    return vi.trash.page.timeAgo.minute(Math.max(minutes, 1));
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return vi.trash.page.timeAgo.hour(hours);
  }

  const days = Math.floor(hours / 24);
  if (days < 30) {
    return vi.trash.page.timeAgo.day(days);
  }

  return vi.trash.page.timeAgo.month(Math.floor(days / 30));
}

function TrashPreview({
  item,
  type,
  onRestore,
  onDeleteForever,
  restoring,
}: {
  item: TrashRecord | null;
  type: EntityType;
  onRestore: (id: string) => void;
  onDeleteForever: (id: string) => void;
  restoring: boolean;
}) {
  if (!item) {
    return (
      <SurfaceCard data-testid="trash-preview" data-focused-id="">
        <div className="p-6">
          <EmptyState
            icon={<Info className="size-5" />}
            title={copy.preview.emptyTitle}
            description={copy.preview.emptyDescription}
          />
        </div>
      </SurfaceCard>
    );
  }

  const config = ENTITY_CONFIG[type];
  const Icon = config.icon;
  const detailItems = buildPreviewItems(type, item);
  const primaryField = config.summary[0];
  const primaryValue = formatFieldValue(
    primaryField.kind,
    resolveFieldValue(item, primaryField.keys),
  );
  const headline =
    primaryValue !== "—" ? String(primaryValue) : `${config.label} #${item.id.slice(0, 8)}`;

  return (
    <SurfaceCard data-testid="trash-preview" data-focused-id={item.id}>
      <SectionHeader
        title={copy.preview.detailTitle}
        description={copy.preview.detailDescription}
      />
      <div className="space-y-5 p-5">
        <div className="rounded-[28px] border border-[var(--border-soft)] bg-[linear-gradient(135deg,rgba(246,250,244,0.96),rgba(255,255,255,0.94))] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-soft)] bg-white/90 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-[var(--fg-muted)]">
                  <Icon className="size-3.5" />
                  {config.label}
                </span>
                <SoftDeletedBadge />
                <span className="inline-flex items-center rounded-full border border-[var(--border-soft)] bg-white/90 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)] font-mono">
                  {item.id.slice(0, 8)}
                </span>
                <span className="inline-flex items-center rounded-full border border-[var(--border-soft)] bg-white/90 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)] font-mono">
                  {getDeletedAgo(item.deleted_at)}
                </span>
              </div>
              <h3 className="break-words text-[20px] font-black tracking-tight text-[var(--fg-base)]">
                {headline}
              </h3>
              <p className="text-[13px] font-medium leading-6 text-[var(--fg-muted)]">
                {copy.preview.deletedAtPrefix} {formatFieldValue("date", item.deleted_at)} · {copy.preview.deletedByPrefix}{" "}
                {String(item.deleted_by ?? "system")}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            type="button"
            variant="primary"
            isLoading={restoring}
            onClick={() => onRestore(item.id)}
          >
            <RotateCcw className="size-4" />
            {vi.trash.page.restoreThis}
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => onDeleteForever(item.id)}
          >
            <Trash2 className="size-4" />
            {vi.trash.page.deleteForever}
          </Button>
        </div>

        <KeyValueList items={detailItems} />

        <div className="rounded-[24px] border border-[var(--border-soft)] bg-[rgba(246,250,244,0.86)] p-4">
          <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.2em] text-[var(--fg-muted)]">
            <Clock3 className="size-4" />
            {copy.preview.audit}
          </div>
          <div className="mt-3 space-y-3 text-[13px] font-medium text-[var(--fg-base)]">
            <div className="flex items-center justify-between gap-3">
              <span>{vi.trash.page.deletedAt}</span>
              <span className="font-mono">{formatFieldValue("date", item.deleted_at)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Độ trễ</span>
              <span className="font-mono">{getDeletedAgo(item.deleted_at)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>{vi.trash.page.deletedBy}</span>
              <span>{String(item.deleted_by ?? "system")}</span>
            </div>
          </div>
        </div>

      </div>
    </SurfaceCard>
  );
}

export default function TrashPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeType, setActiveType] = useState<EntityType>(
    () => parseTrashType(searchParams.get("type")) ?? "customers",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purgeConfirmText, setPurgeConfirmText] = useState("");
  const typeParam = searchParams.get("type");

  const { data: counts = {} as Record<EntityType, number> } = useTrashCounts();
  const { data: trashResponse, isLoading } = useTrashItems(activeType);
  const restoreMutation = useRestoreItems();
  const purgeMutation = usePurgeItems();

  const items = useMemo(() => (trashResponse?.data ?? []) as TrashRecord[], [trashResponse?.data]);
  const config = ENTITY_CONFIG[activeType];

  const filteredItems = useMemo(() => {
    const next = hasSearchTokens(searchQuery)
      ? items.filter((item) => matchesSearchQuery(searchQuery, item))
      : items;

    return [...next].sort((left, right) => {
      const leftTime = new Date(String(left.deleted_at ?? "")).getTime();
      const rightTime = new Date(String(right.deleted_at ?? "")).getTime();
      return sortAsc ? leftTime - rightTime : rightTime - leftTime;
    });
  }, [items, searchQuery, sortAsc]);

  const focusedItem = useMemo(
    () => filteredItems.find((item) => item.id === focusedItemId) ?? filteredItems[0] ?? null,
    [filteredItems, focusedItemId],
  );

  useEffect(() => {
    if (!focusedItemId && filteredItems[0]?.id) {
      setFocusedItemId(filteredItems[0].id);
      return;
    }

    if (focusedItemId && !filteredItems.some((item) => item.id === focusedItemId)) {
      setFocusedItemId(filteredItems[0]?.id ?? null);
    }
  }, [filteredItems, focusedItemId]);

  useEffect(() => {
    setSelectedIds(new Set());
    setSearchQuery("");
  }, [activeType]);

  useEffect(() => {
    const nextType = parseTrashType(typeParam);
    if (nextType && nextType !== activeType) {
      setActiveType(nextType);
    }
  }, [activeType, typeParam]);

  const allSelected =
    filteredItems.length > 0 && filteredItems.every((item) => selectedIds.has(item.id));

  const columns = useMemo<ColumnDef<TrashRecord>[]>(
    () => [
      {
        id: "select",
        header: () => (
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() => {
              setSelectedIds(
                allSelected ? new Set() : new Set(filteredItems.map((item) => item.id)),
              );
            }}
            aria-label={vi.common.selectAll}
          />
        ),
        cell: ({ row }) => {
          const currentId = row.original.id;
          return (
            <input
              type="checkbox"
              checked={selectedIds.has(currentId)}
              onChange={() => {
                setSelectedIds((current) => {
                  const next = new Set(current);
                  if (next.has(currentId)) {
                    next.delete(currentId);
                  } else {
                    next.add(currentId);
                  }
                  return next;
                });
              }}
              data-no-row-click
              aria-label={`select-${currentId}`}
            />
          );
        },
      },
      {
        id: "status",
        header: vi.trash.page.status,
        cell: () => (
          <div className="flex items-center">
            <SoftDeletedBadge className="shrink-0" />
          </div>
        ),
      },
      ...config.summary.map<ColumnDef<TrashRecord>>((field) => ({
        id: field.label,
        header: field.label,
        cell: ({ row }) => {
          const value = resolveFieldValue(row.original, field.keys);
          if (field.kind === "badge") {
            return renderBadge(value);
          }

          return (
            <span className={cn("block max-w-[280px] truncate", (field.kind === "money" || field.kind === "date") && "font-mono")}>
              {formatFieldValue(field.kind, value)}
            </span>
          );
        },
      })),
      {
        id: "deleted_at",
        header: vi.trash.page.deletedLabel,
        cell: ({ row }) => (
          <div className="space-y-1">
            <div className="font-semibold text-[var(--fg-base)] font-mono">
              {getDeletedAgo(row.original.deleted_at)}
            </div>
            <div className="text-[12px] text-[var(--fg-muted)] font-mono">
              {formatFieldValue("date", row.original.deleted_at)}
            </div>
          </div>
        ),
      },
      {
        id: "actions",
        header: vi.trash.page.actions,
              cell: ({ row }) => (
          <div className="flex items-center justify-end" data-no-row-click>
            <ActionMenu
              items={[
                {
                  label: copy.actions.viewDetails,
                  icon: <Eye className="size-4" />,
                  onClick: () => {
                    router.push(getTrashDetailHref(activeType, row.original));
                  },
                },
                {
                  label: vi.trash.page.restore,
                  icon: <RotateCcw className="size-4" />,
                  onClick: () => restoreMutation.mutate({ type: activeType, ids: [row.original.id] }),
                },
                {
                  label: vi.trash.page.deleteForever,
                  icon: <Trash2 className="size-4" />,
                  onClick: () => {
                    setSelectedIds(new Set([row.original.id]));
                    setShowPurgeModal(true);
                  },
                  variant: "danger",
                  dividerBefore: true,
                },
              ]}
            />
          </div>
        ),
      },
    ],
    [activeType, allSelected, config.summary, filteredItems, restoreMutation, router, selectedIds],
  );

  const selectedCount = selectedIds.size;

  const handleRestoreSelected = () => {
    if (selectedIds.size === 0) {
      return;
    }

    restoreMutation.mutate({
      type: activeType,
      ids: Array.from(selectedIds),
    }, {
      onSuccess: () => setSelectedIds(new Set()),
    });
  };

  const handleConfirmPurge = () => {
    if (purgeConfirmText !== vi.trash.page.deleteForeverConfirmText || selectedIds.size === 0) {
      return;
    }

    purgeMutation.mutate(
      {
        type: activeType,
        ids: Array.from(selectedIds),
      },
      {
        onSuccess: () => {
          setSelectedIds(new Set());
          setShowPurgeModal(false);
          setPurgeConfirmText("");
        },
      },
    );
  };

  return (
    <AppLayout>
      <PageContainer variant="wide">
        <PageHeader
          title={vi.trash.page.title}
          description={copy.layout.description}
          eyebrow="Recovery Workspace"
          actions={
            <NextLink
              href="/"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[1rem] border border-[var(--border-soft)] bg-[var(--surface-light)] px-4 text-[13px] font-semibold text-[var(--fg-base)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-strong)]"
            >
              <Home className="size-4" />
              {copy.page.backHome}
            </NextLink>
          }
        />

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Object.entries(ENTITY_CONFIG).map(([key, entity]) => {
            const entityKey = key as EntityType;
            const Icon = entity.icon;

            return (
              <button
                key={entityKey}
                type="button"
                onClick={() => {
                  setActiveType(entityKey);
                  router.replace(`/trash?type=${entityKey}`);
                }}
                className="text-left active:scale-[0.98] transition-transform duration-200"
              >
                <WorkspaceMetricCard
                  label={entity.label}
                  value={counts[entityKey] ?? 0}
                  description={
                    entityKey === activeType
                      ? copy.layout.current
                      : "Nhấn để chuyển sang nhóm dữ liệu này"
                  }
                  icon={<Icon className="size-4" />}
                  tone={entityKey === activeType ? "accent" : "default"}
                  className={cn(entityKey === activeType && "ring-1 ring-[var(--accent)]/25")}
                />
              </button>
            );
          })}
        </div>

        <WorkspaceToolbar>
          <ToolbarField
            label={copy.layout.searchLabel}
            description={copy.layout.searchDescription(filteredItems.length, items.length, config.label)}
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--fg-muted)]" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={vi.trash.page.searchPlaceholder(config.label)}
                className="h-11 pl-10"
              />
            </div>
          </ToolbarField>

          <ToolbarField
            label="Điều khiển"
            description={copy.layout.sortDescription}
          >
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                className="h-11"
                onClick={() => setSortAsc((current) => !current)}
              >
                <ArrowDownUp className="size-4" />
                {sortAsc ? vi.trash.page.sortOldest : vi.trash.page.sortNewest}
              </Button>
              <Button
                type="button"
                variant="primary"
                className="h-11"
                disabled={selectedCount === 0}
                onClick={handleRestoreSelected}
              >
                <RotateCcw className="size-4" />
                {selectedCount > 0
                  ? `${vi.trash.page.restore} (${selectedCount})`
                  : vi.trash.page.restore}
              </Button>
              <Button
                type="button"
                variant="danger"
                className="h-11"
                disabled={selectedCount === 0}
                onClick={() => setShowPurgeModal(true)}
              >
                <Trash2 className="size-4" />
                {selectedCount > 0
                  ? `${vi.trash.page.deleteForever} (${selectedCount})`
                  : vi.trash.page.deleteForever}
              </Button>
            </div>
          </ToolbarField>
        </WorkspaceToolbar>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_360px]">
          <SurfaceCard>
            <SectionHeader
              title={`Danh sách ${config.label.toLowerCase()}`}
              description={copy.layout.tableDescription}
              action={
                selectedCount > 0 ? (
                  <span className="text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
                    {selectedCount} {vi.trash.page.selected}
                  </span>
                ) : null
              }
            />
            <div className="p-4">
              <DataTable
                columns={columns}
                data={filteredItems}
                isLoading={isLoading}
                emptyMessage={
                  hasSearchTokens(searchQuery)
                    ? vi.trash.page.noResultsWithQuery(config.label, searchQuery)
                    : vi.trash.page.noDeletedItems(config.label)
                }
                onRowClick={(item) => {
                  setFocusedItemId(item.id);
                }}
                onRowDoubleClick={(item) => {
                  router.push(getTrashDetailHref(activeType, item));
                }}
              />
            </div>
          </SurfaceCard>

          <TrashPreview
            item={focusedItem}
            type={activeType}
            restoring={restoreMutation.isPending}
            onRestore={(id) => {
              restoreMutation.mutate({ type: activeType, ids: [id] });
            }}
            onDeleteForever={(id) => {
              setSelectedIds(new Set([id]));
              setShowPurgeModal(true);
            }}
          />
        </div>
      </PageContainer>

      <Modal
        isOpen={showPurgeModal}
        onClose={() => {
          setShowPurgeModal(false);
          setPurgeConfirmText("");
        }}
        title={vi.trash.page.deleteForeverTitle(selectedIds.size)}
        size="md"
        footer={
          <div className="grid w-full gap-3 sm:grid-cols-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowPurgeModal(false);
                setPurgeConfirmText("");
              }}
            >
              {vi.common.cancel}
            </Button>
            <Button
              type="button"
              variant="danger"
              isLoading={purgeMutation.isPending}
              disabled={purgeConfirmText !== vi.trash.page.deleteForeverConfirmText}
              onClick={handleConfirmPurge}
            >
              <Trash2 className="size-4" />
              {vi.trash.page.deleteForeverCount(selectedIds.size)}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-4 text-red-700">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0" />
              <div className="space-y-2 text-[13px] font-medium leading-6">
                <p>{vi.trash.page.deleteForeverWarning}</p>
                <p>{vi.trash.page.deleteForeverWarning2}</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--fg-muted)]">
              {vi.trash.page.deleteForeverInputLabel}
            </label>
            <Input
              autoFocus
              value={purgeConfirmText}
              onChange={(event) => setPurgeConfirmText(event.target.value)}
              placeholder={vi.trash.page.deleteForeverInputPlaceholder}
              className="h-11 font-semibold focus-visible:ring-red-200"
            />
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
}
