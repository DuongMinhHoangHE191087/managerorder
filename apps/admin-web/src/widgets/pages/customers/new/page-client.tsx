import { AppLayout } from "@/widgets/layout/app-layout";
import { PageContainer, PageHeader } from "@/shared/ui/page-layout";
import { vi } from "@/shared/messages/vi";
import { CreateCustomerFormShell } from "./create-customer-form-shell";

export const dynamic = "force-dynamic";

export default function NewCustomerPage() {
  const text = vi.customers.newPage;

  return (
    <AppLayout>
      <PageContainer variant="narrow">
        <PageHeader title={text.title} description={text.description} />

        <CreateCustomerFormShell />
      </PageContainer>
    </AppLayout>
  );
}
