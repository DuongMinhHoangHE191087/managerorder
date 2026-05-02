"use client";

import dynamic from "next/dynamic";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

const ReactQueryDevtools =
  process.env.NODE_ENV === "development"
    ? dynamic(
        () => import("@tanstack/react-query-devtools").then((module) => module.ReactQueryDevtools),
        { ssr: false },
      )
    : null;

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 2 * 60_000,          // 2 min — reduce unnecessary refetches
            gcTime: 10 * 60_000,             // 10 min — keep cache longer for back-nav
            refetchOnWindowFocus: false,      // prevent surprise re-renders on tab switch
            refetchOnReconnect: "always",     // refetch after network recovery
            retry: 1,                         // 1 retry before throwing error
            structuralSharing: true,          // skip re-render if data hasn't changed
          },
          mutations: {
            retry: 0,                         // never retry mutations automatically
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {ReactQueryDevtools ? (
        <ReactQueryDevtools initialIsOpen={false} />
      ) : null}
    </QueryClientProvider>
  );
}

