# 🧩 Components & Hooks — Premium Accounts Management System

**Last Updated:** 2026-03-10

---

## Mục Lục

1. [Shared Components (33)](#1-shared-components)
2. [Domain Components](#2-domain-components)
3. [Custom Hooks (13)](#3-custom-hooks)
4. [Design System](#4-design-system)

---

## 1. Shared UI

Shared UI now lives in `src/shared/ui/`.

Legacy catalog entry. Current shared UI lives in `src/shared/ui/`.

### Layout & Navigation

| Component | File | Description |
|-----------|------|-------------|
| **AppShell** | `app-shell.tsx` | Layout wrapper chính (sidebar, main content) |
| **AppNav** | `app-nav.tsx` | Sidebar navigation với active route highlighting |
| **AppLayout** | `app-layout.tsx` | Top-level layout container |

### Data Display

| Component | File | Description |
|-----------|------|-------------|
| **DataTable** | `data-table.tsx` | TanStack Table wrapper — sorting, filtering, pagination, selection |
| **StatCard** | `stat-card.tsx` | Card hiển thị KPI (number + trend) |
| **KPICard** | `kpi-card.tsx` | Dashboard metric card |
| **StatusPill** | `status-pill.tsx` | Badge hiển thị status (paid, active, expired, etc.) |
| **EmptyState** | `empty-state.tsx` | Placeholder khi không có data |
| **Skeleton** | `skeleton.tsx` | Loading skeleton animation |
| **ActivityTimeline** | `activity-timeline.tsx` | Timeline hiển thị activity logs |

### Forms & Input

| Component | File | Description |
|-----------|------|-------------|
| **Input** | `input.tsx` | Styled input wrapper |
| **Button** | `button.tsx` | Button variants (primary, secondary, danger, ghost) |
| **FilterBar** | `filter-bar.tsx` | Search + filter controls cho DataTable |
| **SmartSelector** | `smart-selector.tsx` | Combo-box selector với search |
| **CustomerMiniCombobox** | `customer-mini-combobox.tsx` | Quick customer selector |
| **DynamicContactList** | `dynamic-contact-list.tsx` | Dynamic form list cho contacts |
| **DynamicCredentialList** | `dynamic-credential-list.tsx` | Dynamic form list cho credentials |

### Overlay & Dialog

| Component | File | Description |
|-----------|------|-------------|
| **Modal** | `modal.tsx` | Modal dialog (Framer Motion) — scrollable body |
| **SlideOverDrawer** | `slide-over-drawer.tsx` | Slide-in drawer panel |
| **CommandPalette** | `command-palette.tsx` | Cmd+K command palette (cmdk) |
| **ActionMenu** | `action-menu.tsx` | Dropdown action menu |
| **ContextMenu** | `context-menu.tsx` | Right-click context menu |

### Layout Utilities

| Component | File | Description |
|-----------|------|-------------|
| **SectionCard** | `section-card.tsx` | Card section wrapper |
| **Animations** | `animations.tsx` | Framer Motion animation wrappers |
| **GlobalProviders** | `global-providers.tsx` | React Query + Theme providers |

### CRUD Modals

| Component | File | Description |
|-----------|------|-------------|
| **CustomerCreateModal** | `customer-create-modal.tsx` | Form tạo khách hàng mới |
| **CustomerEditModal** | `customer-edit-modal.tsx` | Form sửa khách hàng |
| **ProductCreateModal** | `product-create-modal.tsx` | Form tạo sản phẩm |
| **ProductEditModal** | `product-edit-modal.tsx` | Form sửa sản phẩm |
| **ServiceCreateModal** | `service-create-modal.tsx` | Form tạo dịch vụ premium |
| **ServiceEditModal** | `service-edit-modal.tsx` | Form sửa dịch vụ |
| **ProviderEditModal** | `provider-edit-modal.tsx` | Form sửa nhà cung cấp |
| **EventCreateModal** | `event-create-modal.tsx` | Form tạo sự kiện calendar |

---

## 2. Route-Local Widgets

Route-local page composition now lives in `src/widgets/pages/**`.

### Orders (`src/widgets/pages/orders/` — route-local widgets)

| Component | Description |
|-----------|-------------|
| **OrdersDataTable** | Table danh sách đơn hàng + actions |
| **OrderCreateModal** | Form tạo đơn hàng (multi-item) |
| **OrderEditModal** | Form sửa đơn hàng |
| **OrderDetailView** | Chi tiết đơn hàng (tabs: info, items, timeline) |
| **OrderItemsForm** | Dynamic form cho order items (add/remove) |
| **ImportOrdersModal** | Upload Excel → preview → import |
| **InvoicePage** | Invoice rendering (print-friendly) |
| **PaymentModal** | Ghi nhận thanh toán |
| **AllocationPanel** | Panel cấp phát kho (preview + confirm) |
| **OrderStatusBadge** | Badge status đơn hàng |
| **OrderFilters** | Filter controls cho order list |

### Inventory (`src/widgets/pages/inventory/` — route-local widgets)

| Component | Description |
|-----------|-------------|
| **InventoryList** | Danh sách source accounts + license keys |
| **InventoryCreateModal** | Form thêm source account |
| **ConnectionManager** | Quản lý kết nối (link/unlink orders) |

### Calendar (`src/widgets/pages/calendar/` — route-local widgets)

| Component | Description |
|-----------|-------------|
| **CalendarView** | Calendar grid (month/week/day views) |
| **EventCard** | Card hiển thị sự kiện |
| **EventDetailModal** | Modal chi tiết sự kiện |
| **DailyNoteEditor** | Editor cho ghi chú hàng ngày |

### Customers (`src/widgets/pages/customers/` — route-local widgets)

| Component | Description |
|-----------|-------------|
| **CustomersDataTable** | Table khách hàng + inline actions |

### Settings (`src/widgets/pages/settings/` — route-local widgets)

| Component | Description |
|-----------|-------------|
| **PaymentSourceManager** | CRUD payment sources |
| **SalesChannelManager** | CRUD sales channels |
| **SystemSettingsForm** | Form cài đặt hệ thống |

### Providers (`src/widgets/pages/providers/` — route-local widgets)

| Component | Description |
|-----------|-------------|
| **ProvidersDataTable** | Table nhà cung cấp |

---

## 3. Hooks

Shared hooks now live in `src/shared/hooks/`, and feature-local hooks live in `src/features/**/hooks/`.

Shared hooks live in `src/shared/hooks/`, and feature-local hooks live in `src/features/**/hooks/`. Use **TanStack React Query** for data fetching + caching.

### Core Hooks

| Hook | File | Queries | Mutations | Description |
|------|------|---------|-----------|-------------|
| **useOrders** | `use-orders.ts` | `orders`, `order-detail` | `create`, `update`, `delete` | Quản lý đơn hàng |
| **useCustomers** | `use-customers.ts` | `customers` | `create`, `update`, `delete` | Quản lý khách hàng |
| **useProducts** | `use-products.ts` | `products` | `create`, `update`, `delete` | Quản lý sản phẩm |
| **useProviders** | `use-providers.ts` | `providers` | `create`, `update`, `delete` | Quản lý nhà cung cấp |
| **useInventory** | `use-inventory.ts` | `inventory` | `create`, `update`, `delete` | License keys |
| **useSourceAccounts** | `use-source-accounts.ts` | `source-accounts`, `connections` | `create`, `update`, `delete`, `connect`, `disconnect`, `reconnect` | Kho tài khoản |
| **useSettings** | `use-settings.ts` | `payment-sources`, `sales-channels`, `system-settings` | CRUD each | Cài đặt hệ thống |

### Feature Hooks

| Hook | File | Description |
|------|------|-------------|
| **useCalendar** | `use-calendar.ts` | Calendar events fetching |
| **useCalendarEvents** | `use-calendar-events.ts` | CRUD calendar events + GCal sync |
| **useCalendarNotes** | `use-calendar-notes.ts` | Daily notes |
| **useActivityLogs** | `use-activity-logs.ts` | Paginated activity logs + filters |
| **usePremium** | `use-premium.ts` | Legacy premium data |

### Utility

| File | Export | Description |
|------|--------|-------------|
| `query-keys.ts` | `queryKeys` | Centralized React Query key factory |

### Query Key Convention

```typescript
// src/shared/lib/react-query/query-keys.ts
export const queryKeys = {
  orders: {
    all: ["orders"] as const,
    detail: (id: string) => ["orders", id] as const,
  },
  customers: {
    all: ["customers"] as const,
  },
  products: {
    all: ["products"] as const,
  },
  // ...
};
```

---

## 4. Design System

### Color Palette (Tailwind)

Hệ thống sử dụng TailwindCSS 3 với custom extended theme:

```
Primary:    Indigo       #4F46E5
Success:    Emerald      #10B981
Warning:    Amber        #F59E0B
Danger:     Red          #EF4444
Neutral:    Slate        #64748B
Background: White/Slate  #FFFFFF / #0F172A (dark)
```

### Typography

- **Font:** System font stack (Inter fallback)
- **Headings:** `text-lg` → `text-3xl`, `font-semibold`
- **Body:** `text-sm`, `text-slate-600`

### Status Colors

| Status | Color | Tailwind |
|--------|-------|----------|
| `draft` | Gray | `bg-gray-100 text-gray-700` |
| `pending_payment` | Amber | `bg-amber-100 text-amber-700` |
| `paid` | Blue | `bg-blue-100 text-blue-700` |
| `provisioning` | Purple | `bg-purple-100 text-purple-700` |
| `active` | Green | `bg-emerald-100 text-emerald-700` |
| `expired` | Red | `bg-red-100 text-red-700` |
| `refunded` | Slate | `bg-slate-100 text-slate-700` |

### Animation System

Sử dụng Framer Motion cho:
- **Page transitions** — FadeIn/SlideUp
- **Modal enter/exit** — Scale + opacity
- **List items** — Stagger animation
- **Route changes** — NextTopLoader

---

*Components & Hooks Documentation — Antigravity — 2026-03-10*
