import { vi } from "@/shared/messages/vi";

export const TRASH_COPY = {
  page: vi.trash.page,
  tabs: vi.trash.tabs,
  fields: vi.trash.fields,
  preview: {
    emptyTitle: "Chọn một mục để xem chi tiết",
    emptyDescription: "",
    detailTitle: "Chi tiết khôi phục",
    detailDescription: "",
    deletedAtPrefix: "Xóa lúc",
    deletedByPrefix: "bởi",
    audit: "Audit",
  },
  layout: {
    title: "Thùng rác",
    description: "",
    searchLabel: "Bộ tìm kiếm",
    searchDescription: (shown: number, total: number, label: string) => "",
    sortDescription: "",
    tableDescription: "",
    current: "Đang xem",
  },
  actions: {
    viewDetails: "Xem chi tiết",
  },
  errors: {
    restoreFailed: "Khôi phục thất bại",
    purgeFailed: "Xóa vĩnh viễn thất bại",
  },
  toasts: {
    restored: (count: number) => `Đã khôi phục ${count} mục`,
    purged: "Đã xóa vĩnh viễn",
  },
} as const;
