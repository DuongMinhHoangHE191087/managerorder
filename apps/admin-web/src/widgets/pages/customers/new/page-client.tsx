import { AppLayout } from "@/widgets/layout/app-layout";
import { PageContainer } from "@/shared/ui/page-layout";
import { CreateCustomerFormShell } from "./create-customer-form-shell";

export const dynamic = "force-dynamic";

export default function NewCustomerPage() {
  return (
    <AppLayout>
      <PageContainer variant="wide">
        <CreateCustomerFormShell />
      </PageContainer>
    </AppLayout>
  );
}
