"use client";

import dynamic from "next/dynamic";
import { Toaster } from "sonner";

// Dynamic import with ssr:false to prevent hydration mismatch
// These components inject DOM during SSR that doesn't match client
const NextTopLoader = dynamic(() => import("nextjs-toploader"), { ssr: false });

/**
 * Client-only providers that must not render during SSR.
 * Prevents hydration mismatch from third-party DOM injection.
 */
export function ClientOnlyProviders() {
  return (
    <>
      <NextTopLoader
        color="var(--accent)"
        initialPosition={0.08}
        crawlSpeed={200}
        height={4}
        crawl={true}
        showSpinner={true}
        easing="ease"
        speed={200}
        shadow="0 0 10px var(--accent),0 0 5px var(--accent)"
        zIndex={120}
        showAtBottom={false}
      />
      <Toaster
        richColors
        position="top-right"
        closeButton
        expand={false}
        gap={8}
        offset={16}
        visibleToasts={4}
        toastOptions={{
          className: "glass-card border-[var(--border-soft)] shadow-xl !rounded-[14px]",
          style: {
            background: "var(--bg-app)",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
            color: "var(--fg-base)",
            border: "1px solid var(--border-soft)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.06)",
            padding: "14px 16px",
          },
          duration: 3500,
        }}
      />
    </>
  );
}
