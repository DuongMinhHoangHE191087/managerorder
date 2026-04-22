"use client";

import Head from "next/head";
import { useEffect } from "react";
import { SalesLandingView } from "@/widgets/marketing/sales-landing-view";
import { vi } from "@/shared/messages/vi";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(vi.common.globalError, error);
  }, [error]);

  return (
    <>
      <Head>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="referrer" content="no-referrer" />
      </Head>
      <SalesLandingView variant="error" errorMessage={error.message} reset={reset} />
    </>
  );
}
