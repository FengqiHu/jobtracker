import { useQuery } from "@tanstack/react-query"

import { getSyncStatus } from "@/lib/api"

export function useSyncStatus() {
  return useQuery({
    queryKey: ["sync-status"],
    queryFn: getSyncStatus,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const data = query.state.data
      return data?.some((item) => item.status === "RUNNING") ? 5_000 : 30_000
    }
  })
}
