import { useQuery } from "@tanstack/react-query"

import { getApplication, getApplicationStats, getApplications } from "@/lib/api"
import type { ApplicationFilters } from "@/lib/types"

export function useApplications(filters: ApplicationFilters) {
  return useQuery({
    queryKey: ["applications", filters],
    queryFn: () => getApplications(filters),
    staleTime: 30_000
  })
}

export function useApplication(id: string | null) {
  return useQuery({
    queryKey: ["application", id],
    queryFn: () => getApplication(id!),
    enabled: Boolean(id),
    staleTime: 15_000
  })
}

export function useApplicationStats() {
  return useQuery({
    queryKey: ["application-stats"],
    queryFn: getApplicationStats,
    staleTime: 60_000
  })
}
