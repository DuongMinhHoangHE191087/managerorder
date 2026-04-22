import type { ComponentProps } from "react";
import PageClient from "@/widgets/pages/inventory/source-accounts/[id]/page-client";

export default function Page(props: ComponentProps<typeof PageClient>) {
  return <PageClient {...props} />;
}
