"use client";

import { SectionCard } from "@/shared/ui/section-card";

const roles = [
  { role: "admin_owner", permissions: "full_access, policy_config, user_management" },
  { role: "sales_staff", permissions: "create_order, view_customer, view_dashboard" },
  { role: "inventory_staff", permissions: "inventory_allocate, inventory_adjust" },
  { role: "customer_support", permissions: "view_order, update_note, create_reminder" },
  { role: "accountant", permissions: "payment_reconcile, debt_followup, refund_approve" },
];

export function SettingsGovernancePanels() {
  return (
    <>
      <SectionCard title="Ma trận quyền (Role matrix)" description="Cấp quyền theo vai trò hệ thống">
        <div className="w-full overflow-hidden rounded-ios-sm border border-[var(--border-soft)] bg-white shadow-sm">
          <table className="min-w-[760px] w-full border-collapse text-left text-sm">
            <thead className="border-b border-[var(--border-soft)] bg-[#f8f9fa] text-[var(--fg-muted)]">
              <tr>
                <th className="h-12 px-4 py-3 text-[12px] font-semibold uppercase tracking-widest">Vai trò</th>
                <th className="h-12 px-4 py-3 text-[12px] font-semibold uppercase tracking-widest">Quyền hạn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-soft)] bg-white">
              {roles.map((item) => (
                <tr key={item.role} className="transition-colors duration-200 hover:bg-[var(--border-soft)]">
                  <td className="p-4 font-bold text-[var(--fg-base)]">{item.role}</td>
                  <td className="p-4 text-[13px] font-medium text-[var(--fg-muted)]">{item.permissions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        title="Chính sách vận hành mặc định"
        description="Cảnh báo công nợ, tự động khóa quá hạn, hỗ trợ hoàn tiền"
      >
        <ul className="space-y-3 rounded-ios-sm border border-[var(--border-soft)] bg-white p-5 text-[14px] font-medium text-[var(--fg-muted)] shadow-sm">
          <li className="flex items-start gap-2">
            <span className="text-[var(--accent)]">•</span>
            Tạo đơn được phép ngay cả khi có công nợ, nhưng cảnh báo mức độ cao.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[var(--accent)]">•</span>
            Tự động khóa dịch vụ active nếu công nợ quá hạn lớn hơn ngưỡng cấu hình.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[var(--accent)]">•</span>
            Lịch nhắc công nợ và gia hạn được tạo để vận hành xử lý sớm.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[var(--accent)]">•</span>
            Chế độ hoàn tiền hỗ trợ toàn phần và một phần theo tỷ lệ sử dụng.
          </li>
        </ul>
      </SectionCard>

      <SectionCard
        title="Release readiness"
        description="Tóm tắt các gate đã chốt trước khi dừng nhánh settings"
      >
        <ul className="space-y-3 rounded-ios-sm border border-[var(--border-soft)] bg-white p-5 text-[14px] font-medium text-[var(--fg-muted)] shadow-sm">
          <li className="flex items-start gap-2">
            <span className="text-[var(--accent)]">•</span>
            <span>
              <strong className="text-[var(--fg-base)]">Sales channels</strong> đã mang policy default cho short-link public và có note rõ về override.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[var(--accent)]">•</span>
            <span>
              <strong className="text-[var(--fg-base)]">Webhooks</strong> có test endpoint thật, validate URL chặt, và audit trail theo user.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[var(--accent)]">•</span>
            <span>
              <strong className="text-[var(--fg-base)]">System settings</strong> vẫn là nguồn cấu hình hóa đơn / thanh toán mặc định, không động vào dữ liệu vận hành.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[var(--accent)]">•</span>
            <span>
              Tất cả thay đổi settings gần nhất đều đã qua <strong className="text-[var(--fg-base)]">typecheck, test, build, visual smoke</strong>.
            </span>
          </li>
        </ul>
      </SectionCard>
    </>
  );
}
