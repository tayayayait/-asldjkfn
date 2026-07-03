import { useQuery } from "@tanstack/react-query";

import { fetchSystemHealth } from "@/lib/api/settings";

export function useSystemHealth() {
  return useQuery({
    queryKey: ["system-health"],
    queryFn: fetchSystemHealth,
    staleTime: 30_000,
  });
}
