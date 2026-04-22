import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/lib/api/fetcher";
import type { InventoryDashboardData } from "@/shared/types/inventory";

export function useInventoryDashboard() {
  return useQuery({
    queryKey: ["inventory-dashboard"],
    queryFn: () => fetcher<InventoryDashboardData>("/api/inventory/dashboard"),
    staleTime: 2 * 60 * 1000,
  });
}
