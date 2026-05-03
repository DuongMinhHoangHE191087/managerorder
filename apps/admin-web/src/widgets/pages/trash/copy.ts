import { vi } from "@/shared/messages/vi";

export const TRASH_COPY = {
  page: vi.trash.page,
  tabs: vi.trash.tabs,
  fields: vi.trash.fields,
  preview: {
    emptyTitle: "Chọn một mục để xem chi tiết",
    emptyDescription:
      "Preview bên phải chỉ hiển thị các trường quan trọng và audit để bạn đối chiếu trước khi khôi phục hoặc xóa vĩnh viễn.",
    detailTitle: "Chi tiết khôi phục",
    detailDescription:
      "Toàn bộ dữ liệu hiện có của bản ghi đã xóa để đối chiếu trước khi khôi phục hoặc xóa vĩnh viễn.",
    deletedAtPrefix: "Xóa lúc",
    deletedByPrefix: "bởi",
    audit: "Audit",
  },
  layout: {
    title: "Thùng rác",
    description:
      "Một surface quản trị duy nhất cho toàn bộ dữ liệu đã xóa, đủ rộng để xem chi tiết, kiểm tra audit và xử lý khôi phục mà không phải chuyển qua từng trang.",
    searchLabel: "Bộ tìm kiếm",
    searchDescription: (shown: number, total: number, label: string) =>
      `Đang hiển thị ${shown}/${total} mục của ${label.toLowerCase()}. Tổng thùng rác hiện có ${total} mục.`,
    sortDescription: "Sắp xếp và thực thi thao tác khôi phục hoặc xóa vĩnh viễn theo nhóm.",
    tableDescription: "Mỗi dòng mở sang preview bên phải. Bản ghi chỉ hiển thị các trường tóm tắt và audit để đối chiếu trước khi khôi phục.",
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
