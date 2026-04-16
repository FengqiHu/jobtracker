import { useQuery } from "@tanstack/react-query"

import { getInterviews, getUpcomingInterviews } from "@/lib/api"

export function useUpcomingInterviews() {
  return useQuery({
    queryKey: ["interviews", "upcoming"],
    queryFn: getUpcomingInterviews,
    staleTime: 30_000
  })
}

export function useInterviewsInRange(from?: string, to?: string) {
  return useQuery({
    queryKey: ["interviews", from, to],
    queryFn: () => getInterviews({ from, to }),
    staleTime: 30_000
  })
}
