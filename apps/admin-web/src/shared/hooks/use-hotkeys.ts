"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { vi } from "@/shared/messages/vi";

let appToastModulePromise: Promise<typeof import("@/shared/ui/app-toast")> | null = null;

function getAppToastModule() {
  appToastModulePromise ??= import("@/shared/ui/app-toast");
  return appToastModulePromise;
}

function showShortcutToast(message: string) {
  void getAppToastModule()
    .then(({ appToast }) => {
      appToast.info(message, { style: { fontSize: "12px" }, duration: 2000 });
    })
    .catch(() => undefined);
}

export function useGlobalHotkeys() {
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        document.activeElement?.tagName === "SELECT"
      ) {
        return;
      }

      // 'N' to create new order (if not in input)
      if (e.key === "n" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        router.push("/orders/new");
        showShortcutToast(vi.common.shortcutUsed("N", vi.navigation.actions.createOrder));
      }

      // 'O' to go to orders
      if (e.key === "o" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        router.push("/orders");
        showShortcutToast(vi.common.shortcutUsed("O", vi.navigation.items.orders));
      }

      // 'I' to go to inventory
      if (e.key === "i" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        router.push("/inventory");
        showShortcutToast(vi.common.shortcutUsed("I", vi.navigation.items.inventory));
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [router]);
}
