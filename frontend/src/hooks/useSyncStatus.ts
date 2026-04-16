import { useQuery } from "@tanstack/react-query"

import { getSyncStatus } from "@/lib/api"

export function useSyncStatus() {
  return useQuery({
    queryKey: ["sync-status"],
    queryFn: getSyncStatus,
    refetchInterval: (query) => {
      const data = query.state.data
      return data?.some((item) => item.status === "RUNNING") ? 2_000 : 10_000
    }
  })
}
