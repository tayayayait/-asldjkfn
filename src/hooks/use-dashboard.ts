import { useQuery } from "@tanstack/react-query";

import { fetchDashboardData } from "@/lib/api/dashboard";

export function useDashboardData() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboardData,
    staleTime: 20_000,
  });
}
