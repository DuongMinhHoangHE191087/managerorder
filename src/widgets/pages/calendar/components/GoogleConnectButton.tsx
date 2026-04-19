"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { appToast } from "@/shared/ui/app-toast";
import { Plug, CheckCircle2 } from "lucide-react";
import { ScaleButton } from "@/shared/ui/animations";

export function GoogleConnectButton() {
  const searchParams = useSearchParams();
  const initiallyConnected = searchParams.get("gcal_connected") === "true";
  const [isConnected, _setIsConnected] = useState(initiallyConnected);

  useEffect(() => {
    if (initiallyConnected) {
      appToast.success("Kết nối Google Calendar thành công!");
      const url = new URL(window.location.href);
      url.searchParams.delete("gcal_connected");
      window.history.replaceState({}, "", url.toString());
    }
  }, [initiallyConnected]);

  const handleConnect = () => {
    window.location.href = `/api/auth/google/login`;
  };

  if (isConnected) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-600 text-xs font-bold shadow-sm">
        <CheckCircle2 className="size-3.5" />
        Đã kết nối GCal
      </div>
    );
  }

  return (
    <ScaleButton
      onClick={handleConnect}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[var(--border-soft)] hover:bg-[var(--surface-light)] text-[var(--fg-base)] text-xs font-bold transition-colors shadow-sm cursor-pointer"
    >
      <Plug className="size-3.5 text-[var(--accent)]" />
      Kết nối GCal
    </ScaleButton>
  );
}
