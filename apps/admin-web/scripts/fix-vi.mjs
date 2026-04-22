import fs from "node:fs";

const path = "D:/GITHUB/managerorder/premium-admin-web/src/shared/messages/vi.ts";
const lines = fs.readFileSync(path, "utf8").split(/\r?\n/);

function findLineIndex(value, start = 0) {
  for (let i = start; i < lines.length; i += 1) {
    if (lines[i] === value) return i;
  }
  return -1;
}

function findLineContaining(needle, start = 0) {
  for (let i = start; i < lines.length; i += 1) {
    if (lines[i].includes(needle)) return i;
  }
  return -1;
}

function replaceRange(start, endExclusive, replacement) {
  if (start < 0 || endExclusive < start) {
    throw new Error(`Invalid replacement range: ${start}..${endExclusive}`);
  }
  lines.splice(start, endExclusive - start, ...replacement);
}

const groupTagBlock = [
  '    groupTagManager: {',
  '      tabs: {',
  '        groups: "Nhóm",',
  '        tags: "Tags",',
  '      },',
  '      loading: "Đang tải...",',
  '      groups: {',
  '        createTitle: "Tạo nhóm mới",',
  '        namePlaceholder: "Tên nhóm...",',
  '        create: "Tạo",',
  '        color: "Màu sắc",',
  '        descriptionPlaceholder: "Mô tả nhóm (tùy chọn)...",',
  '        emptyTitle: "Chưa có nhóm nào",',
  '        emptyDescription: "Tạo nhóm đầu tiên ở trên",',
  '        edit: "Sửa",',
  '        delete: "Xóa",',
  '        confirmTitle: "Xác nhận xóa nhóm?",',
  '        confirmDescription: (name: string) => `Nhóm "${name}" sẽ bị xóa khỏi bộ lọc và tự động gỡ khỏi các khách hàng liên quan.`,',
  '        cancel: "Hủy",',
  '        deleting: "Đang xóa...",',
  '        confirmDelete: "Xóa nhóm",',
  '      },',
  '      tags: {',
  '        createTitle: "Tạo tag mới",',
  '        namePlaceholder: "Tên tag...",',
  '        create: "Tạo",',
  '        color: "Màu sắc",',
  '        descriptionPlaceholder: "Mô tả tag (tùy chọn)...",',
  '        emptyTitle: "Chưa có tag nào",',
  '        emptyDescription: "Tạo tag đầu tiên ở trên",',
  '        edit: "Sửa",',
  '        delete: "Xóa",',
  '        confirmTitle: "Xác nhận xóa tag?",',
  '        confirmDescription: (name: string) => `Tag "${name}" sẽ bị xóa khỏi bộ lọc và tự động gỡ khỏi các khách hàng liên quan.`,',
  '        cancel: "Hủy",',
  '        deleting: "Đang xóa...",',
  '        confirmDelete: "Xóa tag",',
  '      },',
  '    },',
];

const calendarBlock = [
  '    dayNames: [',
  '      "Chủ nhật",',
  '      "Thứ Hai",',
  '      "Thứ Ba",',
  '      "Thứ Tư",',
  '      "Thứ Năm",',
  '      "Thứ Sáu",',
  '      "Thứ Bảy",',
  '    ],',
  '    weekdayLabels: ["CN", "T2", "T3", "T4", "T5", "T6", "T7"],',
  '    allDay: "Cả ngày",',
  '    combobox: {',
  '      placeholder: "Tìm khách hàng...",',
  '      createLabel: "Tạo khách hàng mới",',
  '      emptyText: "Không tìm thấy khách hàng phù hợp",',
  '      noContact: "Chưa có liên hệ",',
  '    },',
  '    eventCreate: {',
  '      title: "Thêm sự kiện mới",',
  '      subtitle: "Lịch CRM & nhắc nhở",',
  '      types: {',
  '        reminder: "Nhắc nhở",',
  '        renewal: "Gia hạn",',
  '        follow_up: "Chăm sóc",',
  '        meeting: "Cuộc hẹn",',
  '        payment: "Thu tiền",',
  '      },',
  '      labels: {',
  '        type: "Loại sự kiện",',
  '        title: "Tiêu đề",',
  '        date: "Ngày",',
  '        time: "Giờ (tùy chọn)",',
  '        customer: "Liên kết khách hàng",',
  '        notes: "Ghi chú",',
  '        reminder: "Bật nhắc nhở",',
  '        reminderDescription: "Nhận thông báo trước sự kiện",',
  '      },',
  '      placeholders: {',
  '        title: "VD: Gọi điện cho anh Long về gia hạn...",',
  '        notes: "Thêm ghi chú hoặc mô tả...",',
  '      },',
  '      buttons: {',
  '        cancel: "Hủy",',
  '        saving: "Đang lưu...",',
  '        create: "Tạo sự kiện",',
  '      },',
  '      errors: {',
  '        titleRequired: "Vui lòng nhập tiêu đề sự kiện",',
  '        dateRequired: "Vui lòng chọn ngày",',
  '        createFailed: "Lỗi tạo sự kiện",',
  '      },',
  '      success: (title: string) => `Đã tạo sự kiện "${title}"!`,',
  '    },',
  '    eventDetail: {',
  '      title: "Chi tiết Sự kiện",',
  '      done: "Đã hoàn thành",',
  '      markDone: "Đánh dấu hoàn thành",',
  '      delete: "Xóa sự kiện",',
  '      typeLabels: {',
  '        reminder: "Nhắc nhở",',
  '        renewal: "Gia hạn",',
  '        follow_up: "Chăm sóc",',
  '        meeting: "Cuộc hẹn",',
  '        payment: "Thu tiền",',
  '        debt: "Công nợ",',
  '      },',
  '      linkedCustomers: (count: number) => `Khách hàng liên kết (${count})`,',
  '      labels: {',
  '        date: "Ngày",',
  '        time: "Giờ",',
  '        allDay: "Cả ngày",',
  '        internalNotes: "Ghi chú nội bộ",',
  '      },',
  '      noReminder: "Không có nhắc nhở hệ thống cho sự kiện này",',
  '    },',
  '    eventDelete: {',
  '      title: "Xác nhận xóa",',
  '      cancel: "Hủy",',
  '      confirm: "Xóa vĩnh viễn",',
  '      question: "Bạn chắc chắn muốn xóa?",',
  '      body: (title: string) => `Sự kiện "${title}" sẽ bị xóa vĩnh viễn.`,',
  '    },',
  '    google: {',
  '      success: "Kết nối Google Calendar thành công!",',
  '      connected: "Đã kết nối GCal",',
  '      connect: "Kết nối GCal",',
  '    },',
  '    renewalCard: {',
  '      expired: "Đã hết hạn",',
  '      shortDaysSuffix: "n",',
  '      expiryPrefix: "Hết hạn: ",',
  '      requestRenewal: "Yêu cầu gia hạn",',
  '      pending: "Đang chờ",',
  '      emptyTitle: "Không có gia hạn sắp tới",',
  '      emptyDescription: "Tất cả subscriptions đang ổn định",',
  '    },',
  '    renewalPanel: {',
  '      tabs: {',
  '        all: "Tất cả",',
  '        expired: "Hết hạn",',
  '        urgent3: "≤ 3 ngày",',
  '        urgent7: "≤ 7 ngày",',
  '        urgent30: "≤ 30 ngày",',
  '      },',
  '      title: "Sắp gia hạn",',
  '      refresh: "Tải lại",',
  '      bulkReminder: "Gửi nhắc nhở hàng loạt",',
  '      exportExcel: "Xuất Excel",',
  '      searchPlaceholder: "Tìm khách hàng, dịch vụ...",',
  '      retry: "Thử lại",',
  '      markPaidTitle: "Đánh dấu đã thanh toán",',
  '      manualCancelTitle: "Hủy & Xóa",',
  '      footerPrefix: "Hiển thị",',
  '      footerSuffix: "mục gia hạn",',
  '      bulkReminderSuccess: (count: number) => `Đã gửi thông báo đến ${count} KH sắp hết hạn`,',
  '      exportDemoInfo: "Tính năng kết xuất danh sách (demo)",',
  '    },',
];

const groupStarts = [];
for (let i = 0; i < lines.length; i += 1) {
  if (lines[i] === '    groupTagManager: {') groupStarts.push(i);
}

if (groupStarts.length >= 1) {
  const start = groupStarts[0];
  const end = findLineContaining('paymentModal:', start + 1);
  if (end >= 0) {
    replaceRange(start, end + 1, [...groupTagBlock, '    paymentModal: {']);
  }
}

const providerGroupStart = findLineIndex('    groupTagManager: {', groupStarts[0] + 1);
if (providerGroupStart >= 0) {
  const providerPayment = findLineContaining('paymentModal:', providerGroupStart + 1);
  if (providerPayment >= 0) {
    replaceRange(providerGroupStart, providerPayment + 1, ['    paymentModal: {']);
  }
}

const calendarStart = findLineIndex('    dayNames: [', 0);
if (calendarStart >= 0) {
  const calendarEnd = findLineIndex('    monthNames: [', calendarStart + 1);
  if (calendarEnd >= 0) {
    replaceRange(calendarStart, calendarEnd, calendarBlock);
  }
}

for (let i = 0; i < lines.length; i += 1) {
  if (lines[i] === '      markDone: "Mark done",') {
    lines[i] = '      markDone: "Đánh dấu hoàn thành",';
  }
}

fs.writeFileSync(path, lines.join("\n"), "utf8");
