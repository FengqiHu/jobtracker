import { Badge } from "@/components/ui/badge"
import type { ApplicationStatus } from "@/lib/types"

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  const variantMap = {
    APPLIED: "applied",
    INTERVIEWING: "interviewing",
    OFFER: "offer",
    REJECTED: "rejected",
    WITHDRAWN: "withdrawn"
  } as const

  return <Badge variant={variantMap[status]}>{status.replace("_", " ")}</Badge>
}
