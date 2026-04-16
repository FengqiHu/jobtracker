import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { RefreshCw } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip"
import { getEmailAccounts, triggerSync } from "@/lib/api"
import { formatRelativeTime } from "@/lib/utils"

function dotColor(status: string) {
  if (status === "RUNNING") return "bg-amber-400"
  if (status === "FAILED") return "bg-red-500"
  return "bg-emerald-500"
}

export function SyncStatusBar() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ["email-accounts"],
    queryFn: getEmailAccounts,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const accounts = query.state.data
      return accounts?.some((a) => a.latestSync?.status === "RUNNING") ? 5_000 : 30_000
    }
  })

  const mutation = useMutation({
    mutationFn: triggerSync,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["email-accounts"] })
      toast.success("Sync started")
    },
    onError: () => toast.error("Unable to start sync")
  })

  return (
    <div className="rounded-[16px] bg-white p-4 shadow-card">
      <div className="mb-3">
        <p className="font-display text-[18px] font-semibold text-[#242424]">Sync status</p>
        <p className="text-sm text-[#898989]">Watch every inbox without leaving the app.</p>
      </div>

      <div className="space-y-3">
        {isLoading && <p className="text-sm text-[#898989]">Loading sync state...</p>}
        {!isLoading && !data?.length && (
          <p className="text-sm text-[#898989]">No connected inboxes yet.</p>
        )}
        {data?.map((account) => {
          const status = account.latestSync?.status ?? "PENDING"
          return (
            <div
              key={account.id}
              className="flex items-center justify-between gap-3 rounded-[12px] bg-[#fafafa] px-3 py-3"
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`h-2.5 w-2.5 rounded-full ${dotColor(status)}`} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#242424]">
                        {account.email}
                      </p>
                      <p className="truncate text-xs text-[#898989]">
                        {status === "RUNNING"
                          ? "Syncing now"
                          : `Last update ${formatRelativeTime(account.latestSync?.completedAt ?? null)}`}
                      </p>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{account.email}</p>
                  <p>Status: {status}</p>
                  {account.latestSync?.errorMessage ? <p>{account.latestSync.errorMessage}</p> : null}
                </TooltipContent>
              </Tooltip>

              <Button
                size="icon"
                variant="ghost"
                onClick={() => mutation.mutate(account.id)}
                disabled={mutation.isPending}
                aria-label={`Sync ${account.email}`}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
