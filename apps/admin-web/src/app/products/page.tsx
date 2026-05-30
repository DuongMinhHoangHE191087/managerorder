import PageClient from "@/widgets/pages/products/page-client";
import { Suspense } from "react";
import { PageShellSkeleton } from "@/shared/ui/page-shell-skeleton";

export default function Page() {
  return (
    <Suspense fallback={<PageShellSkeleton />}>
      <PageClient />
    </Suspense>
  );
}
