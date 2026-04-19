 "use client";

import { AppLayout } from "@/widgets/layout/app-layout";
import { PageContainer } from "@/shared/ui/page-layout";
import { SettingsPageHeader } from "./components/settings-page-header";
import { SettingsGovernancePanels } from "./components/settings-governance-panels";
import { SettingsOverviewPanels } from "./components/settings-overview-panels";

export default function SettingsPage() {
  return (
    <AppLayout>
      <PageContainer>
        <SettingsPageHeader />
        <SettingsOverviewPanels />
        <SettingsGovernancePanels />
      </PageContainer>
    </AppLayout>
  );
}
