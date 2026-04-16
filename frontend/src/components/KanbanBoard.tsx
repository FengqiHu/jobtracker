import { useEffect, useRef, useState } from "react"
import { CalendarPlus, ChevronRight } from "lucide-react"

import { StatusBadge } from "@/components/StatusBadge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import type { Application, ApplicationStatus } from "@/lib/types"
import { formatDate } from "@/lib/utils"

const columns: ApplicationStatus[] = ["APPLIED", "INTERVIEWING", "OFFER", "REJECTED"]

type Props = {
  applications: Application[]
  onOpen: (id: string) => void
  onStatusChange: (id: string, status: ApplicationStatus) => void
  onAddInterview: (id: string) => void
}

export function KanbanBoard({
  applications,
  onOpen,
  onStatusChange,
  onAddInterview
}: Props) {
  const prevIdsRef = useRef<Set<string>>(new Set())
  const [newIds, setNewIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const currentIds = new Set(applications.map((a) => a.id))
    // Only animate additions after the initial render (prevIds non-empty)
    if (prevIdsRef.current.size > 0) {
      const added = applications.filter((a) => !prevIdsRef.current.has(a.id))
      if (added.length > 0) {
        setNewIds(new Set(added.map((a) => a.id)))
        const timer = setTimeout(() => setNewIds(new Set()), 500)
        prevIdsRef.current = currentIds
        return () => clearTimeout(timer)
      }
    }
    prevIdsRef.current = currentIds
  }, [applications])
  return (
    <div className="grid gap-4 xl:grid-cols-4">
      {columns.map((column) => {
        const items = applications.filter((item) => item.status === column)
        return (
          <div key={column} className="overflow-hidden rounded-[18px] bg-[#fbfbfb] p-4 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <StatusBadge status={column} />
              <span className="rounded-full bg-white px-3 py-1 text-xs font-medium shadow-card">
                {items.length}
              </span>
            </div>

            {/* negative margin + matching padding pushes the scrollbar into the column's
                right-padding zone, so cards stay at their original width */}
            <div
              className="kanban-column-scroll space-y-3 overflow-y-auto"
              style={{ maxHeight: "calc(100vh - 320px)" }}
            >
              {items.map((application) => (
                <button
                  key={application.id}
                  onClick={() => onOpen(application.id)}
                  className={`w-full rounded-[16px] bg-white p-4 text-left shadow-card transition-transform hover:-translate-y-0.5 ${newIds.has(application.id) ? "kanban-card-enter" : ""}`}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-[18px] font-semibold text-[#242424]">
                        {application.company}
                      </p>
                      <p className="text-sm text-[#898989]">{application.role}</p>
                    </div>
                    <ChevronRight className="mt-1 h-4 w-4 text-[#a0a0a0]" />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-[#898989]">
                      <span>Applied</span>
                      <span>{application.appliedAt ? formatDate(application.appliedAt) : "—"}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-[#898989]">
                      <span>Next interview</span>
                      <span>
                        {application.interviews[0]
                          ? formatDate(application.interviews[0].scheduledAt)
                          : "None"}
                      </span>
                    </div>
                    <div className="grid gap-2">
                      <Select
                        value={application.status}
                        onValueChange={(value) =>
                          onStatusChange(application.id, value as ApplicationStatus)
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["APPLIED", "INTERVIEWING", "OFFER", "REJECTED", "WITHDRAWN"].map(
                            (status) => (
                              <SelectItem key={status} value={status}>
                                {status}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(event) => {
                          event.stopPropagation()
                          onAddInterview(application.id)
                        }}
                      >
                        <CalendarPlus className="h-4 w-4" />
                        Add interview
                      </Button>
                    </div>
                  </div>
                </button>
              ))}
              {!items.length ? (
                <div className="rounded-[14px] border border-dashed border-[#dedede] px-4 py-6 text-center text-sm text-[#898989]">
                  No applications here yet.
                </div>
              ) : null}
            </div>
          </div>

        )
      })}
    </div>
  )
}
