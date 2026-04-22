"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Plug } from "lucide-react";
import { vi } from "@/shared/messages/vi";
import { appToast } from "@/shared/ui/app-toast";
import { ScaleButton } from "@/shared/ui/animations";

export function GoogleConnectButton() {
  const text = vi.calendar.google;
  const searchParams = useSearchParams();
  const initiallyConnected = searchParams.get("gcal_connected") === "true";
  const [isConnected, _setIsConnected] = useState(initiallyConnected);

  useEffect(() => {
    if (!initiallyConnected) {
      return;
    }

    appToast.success(text.success);
    const url = new URL(window.location.href);
    url.searchParams.delete("gcal_connected");
    window.history.replaceState({}, "", url.toString());
  }, [initiallyConnected, text.success]);

  function handleConnect() {
    window.location.href = "/api/auth/google/login";
  }

  if (isConnected) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1.5 text-xs font-bold text-green-600 shadow-sm">
        <CheckCircle2 className="size-3.5" />
        {text.connected}
      </div>
    );
  }

  return (
    <ScaleButton
      onClick={handleConnect}
      className="flex cursor-pointer items-center gap-2 rounded-full border border-[var(--border-soft)] bg-white px-3 py-1.5 text-xs font-bold text-[var(--fg-base)] shadow-sm transition-colors hover:bg-[var(--surface-light)]"
    >
      <Plug className="size-3.5 text-[var(--accent)]" />
      {text.connect}
    </ScaleButton>
  );
}
