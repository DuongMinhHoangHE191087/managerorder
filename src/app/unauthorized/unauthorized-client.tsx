"use client";

import { useRouter } from "next/navigation";
import { SalesLandingView } from "@/widgets/marketing/sales-landing-view";

export function UnauthorizedClientPage() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      const { createSupabaseBrowserClient } = await import("@/lib/supabase/client");
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut({ scope: "global" });
    } finally {
      router.replace("/login");
    }
  };

  return <SalesLandingView variant="unauthorized" reset={handleLogout} resetLabel="Đăng xuất và quay lại" />;
}
