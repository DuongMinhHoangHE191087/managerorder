import { AppLayout } from "@/widgets/layout/app-layout";
import { PageContainer, PageHeader } from "@/shared/ui/page-layout";
import { CreateCustomerFormShell } from "./create-customer-form-shell";

export const dynamic = "force-dynamic";

export default function NewCustomerPage() {
  return (
    <AppLayout>
      <PageContainer variant="narrow">
        <PageHeader
          title="Thêm Khách Hàng"
          description="Cập nhật dữ liệu khách hàng mới vào hệ thống quản trị."
        />

        <CreateCustomerFormShell />
      </PageContainer>
    </AppLayout>
  );
}
