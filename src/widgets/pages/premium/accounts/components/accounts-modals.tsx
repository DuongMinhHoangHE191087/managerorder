"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Modal } from "@/shared/ui/modal";
import { Select } from "@/shared/ui/select";
import type { PremiumAccountPackage, PremiumAccountRow, PremiumAccountService } from "../types";

export function AccountsModals({
  isCreateOpen,
  selectedServiceId,
  today,
  services,
  packages,
  onCloseCreate,
  onServiceChange,
  onSubmitCreate,
  deletingAccount,
  onCloseDelete,
  onDelete,
}: {
  isCreateOpen: boolean;
  selectedServiceId: string;
  today: string;
  services: PremiumAccountService[];
  packages: PremiumAccountPackage[];
  onCloseCreate: () => void;
  onServiceChange: (value: string) => void;
  onSubmitCreate: (formData: FormData) => void | Promise<void>;
  deletingAccount: PremiumAccountRow | null;
  onCloseDelete: () => void;
  onDelete: () => void | Promise<void>;
}) {
  return (
    <>
      <Modal
        isOpen={isCreateOpen}
        onClose={onCloseCreate}
        title="Thêm Tài Khoản Vào Kho"
        size="2xl"
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={onCloseCreate} className="w-full sm:w-auto">
              Hủy
            </Button>
            <Button variant="primary" type="submit" form="create-account-form" className="w-full sm:w-auto">
              Lưu Vào Kho
            </Button>
          </div>
        }
      >
        <form
          id="create-account-form"
          onSubmit={(event) => {
            event.preventDefault();
            void onSubmitCreate(new FormData(event.currentTarget));
          }}
          className="space-y-6"
        >
          <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)]/60 p-4 sm:p-5">
            <div className="mb-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">Dịch vụ và gói</p>
              <p className="text-sm text-[var(--fg-muted)]">Chọn dịch vụ trước để hệ thống nạp đúng gói cước và số slot.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                  Nền tảng / Dịch vụ *
                </label>
                <Select
                  name="service_type_id"
                  required
                  value={selectedServiceId}
                  onChange={(event) => onServiceChange(event.target.value)}
                  className="h-11 rounded-[1rem] text-[13px] font-medium"
                >
                  <option value="">-- Chọn dịch vụ --</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                  Gói cước phân chia *
                </label>
                <Select
                  name="package_id"
                  required
                  disabled={!selectedServiceId}
                  className="h-11 rounded-[1rem] text-[13px] font-medium disabled:opacity-50"
                >
                  <option value="">-- Chọn loại tài khoản --</option>
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} ({pkg.total_slots} slots)
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-4 sm:p-5">
            <div className="mb-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">Thông tin đăng nhập</p>
              <p className="text-sm text-[var(--fg-muted)]">Form này giữ nguyên dữ liệu nếu API trả lỗi để bạn sửa trực tiếp.</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                  Email đăng nhập gốc *
                </label>
                <Input name="primary_email" type="email" placeholder="vd: super-admin1@gmail.com" required />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                  Mật khẩu cấp *
                </label>
                <Input name="primary_password" type="text" placeholder="Pass của Email/Dịch vụ" required />
                <p className="mt-1 text-[10px] text-[var(--fg-muted)]">
                  Mật khẩu được lưu hóa mã bảo mật một chiều AES-256 trên server.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-4 sm:p-5">
            <div className="mb-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">Mốc thuê bao gốc</p>
              <p className="text-sm text-[var(--fg-muted)]">
                Ngày bắt đầu và ngày hết hạn gốc giúp renewals, notifications và health checks bám đúng vòng đời tài khoản.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                  Ngày bắt đầu (Gốc)
                </label>
                <Input name="subscription_start_date" type="date" defaultValue={today} required />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                  Ngày hết hạn (Gốc) *
                </label>
                <Input name="subscription_expiry_date" type="date" required />
              </div>
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(deletingAccount)}
        onClose={onCloseDelete}
        title="Xác nhận xóa tài khoản"
        size="sm"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={onCloseDelete}>
              Hủy
            </Button>
            <Button
              variant="primary"
              onClick={onDelete}
              className="!bg-[var(--danger)] !font-bold !shadow-none hover:!bg-[var(--danger)]"
            >
              Xóa Vĩnh Viễn
            </Button>
          </div>
        }
      >
        <div className="py-4 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-[var(--danger)]/10">
            <Trash2 className="size-8 text-[var(--danger)]" />
          </div>
          <p className="mb-2 text-[15px] font-bold text-[var(--fg-base)]">Bạn chắc chắn muốn xóa?</p>
          <p className="text-[13px] text-[var(--fg-muted)]">
            Hành động này sẽ xóa dữ liệu theo dõi của tài khoản gốc này. Các khách hàng trong nhóm có thể bị lỗi truy cập.
          </p>
        </div>
      </Modal>
    </>
  );
}
