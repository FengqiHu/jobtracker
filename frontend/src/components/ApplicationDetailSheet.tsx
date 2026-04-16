import { useEffect, useMemo, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { CalendarPlus, ExternalLink, PencilLine, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { StatusBadge } from "@/components/StatusBadge"
import { InterviewDialog } from "@/components/InterviewDialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { deleteApplication, deleteInterview, patchApplication } from "@/lib/api"
import { useApplication } from "@/hooks/useApplications"
import type { ApplicationStatus, Interview } from "@/lib/types"
import { formatDateTime } from "@/lib/utils"

const statuses: ApplicationStatus[] = [
  "APPLIED",
  "INTERVIEWING",
  "OFFER",
  "REJECTED",
  "WITHDRAWN"
]

type Props = {
  applicationId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ApplicationDetailSheet({ applicationId, open, onOpenChange }: Props) {
  const queryClient = useQueryClient()
  const { data, isLoading } = useApplication(applicationId)
  const [notes, setNotes] = useState("")
  const [status, setStatus] = useState<ApplicationStatus>("APPLIED")
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [editingInterview, setEditingInterview] = useState<Interview | undefined>()

  useEffect(() => {
    if (!data) {
      return
    }

    setNotes(data.notes ?? "")
    setStatus(data.status)
  }, [data])

  const patchMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => patchApplication(applicationId!, body),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["applications"] }),
        queryClient.invalidateQueries({ queryKey: ["application", applicationId] }),
        queryClient.invalidateQueries({ queryKey: ["application-stats"] })
      ])
    },
    onError: () => toast.error("Unable to update application")
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteApplication(applicationId!),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["applications"] }),
        queryClient.invalidateQueries({ queryKey: ["application-stats"] }),
        queryClient.invalidateQueries({ queryKey: ["interviews"] })
      ])
      toast.success("Application deleted")
      onOpenChange(false)
    },
    onError: () => toast.error("Unable to delete application")
  })

  const deleteInterviewMutation = useMutation({
    mutationFn: (id: string) => deleteInterview(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["interviews"] }),
        queryClient.invalidateQueries({ queryKey: ["applications"] }),
        queryClient.invalidateQueries({ queryKey: ["application", applicationId] })
      ])
      toast.success("Interview deleted")
    },
    onError: () => toast.error("Unable to delete interview")
  })

  useEffect(() => {
    if (!data || notes === (data.notes ?? "")) {
      return
    }

    const timeout = window.setTimeout(() => {
      patchMutation.mutate({ notes })
    }, 1000)

    return () => window.clearTimeout(timeout)
  }, [data, notes, patchMutation])

  const upcoming = useMemo(
    () =>
      (data?.interviews ?? []).filter(
        (interview) => new Date(interview.scheduledAt).getTime() >= Date.now()
      ),
    [data?.interviews]
  )

  const past = useMemo(
    () =>
      (data?.interviews ?? []).filter(
        (interview) => new Date(interview.scheduledAt).getTime() < Date.now()
      ),
    [data?.interviews]
  )

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{data?.company ?? "Application details"}</SheetTitle>
            <SheetDescription>
              Edit the application record, keep notes tidy, and manage the interview trail.
            </SheetDescription>
          </SheetHeader>

          {isLoading ? (
            <p className="text-sm text-[#898989]">Loading application...</p>
          ) : data ? (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{data.role}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusBadge status={data.status} />
                    {data.aiConfidence ? (
                      <span className="text-xs text-[#898989]">
                        AI confidence: {Math.round(data.aiConfidence * 100)}%
                      </span>
                    ) : null}
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#8a8a8a]">
                        Account
                      </p>
                      <p className="text-sm text-[#242424]">
                        {data.emailAccount?.label || data.emailAccount?.email || "Manual entry"}
                      </p>
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#8a8a8a]">
                        Source subject
                      </p>
                      <p className="text-sm text-[#242424]">{data.emailSubject || "Manual entry"}</p>
                      {data.emailMessageId && data.emailAccount?.provider === "gmail" ? (
                        <a
                          href={`https://mail.google.com/mail/u/0/#all/${data.emailMessageId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View in Gmail
                        </a>
                      ) : null}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8a8a8a]">
                      Status
                    </p>
                    <Select
                      value={status}
                      onValueChange={(value) => {
                        const next = value as ApplicationStatus
                        setStatus(next)
                        patchMutation.mutate({ status: next })
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statuses.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8a8a8a]">
                      Notes
                    </p>
                    <Textarea
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Add prep notes, follow-up reminders, or context."
                    />
                    <p className="text-xs text-[#898989]">Auto-saves one second after you stop typing.</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle>Interview timeline</CardTitle>
                  <Button size="sm" onClick={() => setScheduleOpen(true)}>
                    <CalendarPlus className="h-4 w-4" />
                    Schedule interview
                  </Button>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#8a8a8a]">
                      Upcoming
                    </p>
                    <div className="space-y-3">
                      {upcoming.map((interview) => (
                        <div
                          key={interview.id}
                          className="rounded-[14px] bg-[#fafafa] px-4 py-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-[#242424]">{interview.title}</p>
                              <p className="text-sm text-[#898989]">
                                {formatDateTime(interview.scheduledAt)}
                              </p>
                              {interview.location ? (
                                <p className="text-sm text-[#898989]">{interview.location}</p>
                              ) : null}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingInterview(interview)}
                              >
                                <PencilLine className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteInterviewMutation.mutate(interview.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                      {!upcoming.length ? (
                        <p className="text-sm text-[#898989]">No upcoming interviews scheduled.</p>
                      ) : null}
                    </div>
                  </div>

                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#8a8a8a]">
                      Past
                    </p>
                    <div className="space-y-3">
                      {past.map((interview) => (
                        <div key={interview.id} className="rounded-[14px] bg-[#f7f7f7] px-4 py-4 opacity-80">
                          <p className="font-medium text-[#242424]">{interview.title}</p>
                          <p className="text-sm text-[#898989]">
                            {formatDateTime(interview.scheduledAt)}
                          </p>
                        </div>
                      ))}
                      {!past.length ? <p className="text-sm text-[#898989]">No past interviews.</p> : null}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Button
                className="w-full"
                variant="ghost"
                onClick={() => deleteMutation.mutate()}
              >
                <Trash2 className="h-4 w-4" />
                Delete application
              </Button>
            </div>
          ) : (
            <p className="text-sm text-[#898989]">Application not found.</p>
          )}
        </SheetContent>
      </Sheet>

      {data ? (
        <InterviewDialog
          open={scheduleOpen}
          onOpenChange={setScheduleOpen}
          applications={[data]}
          defaultApplicationId={data.id}
        />
      ) : null}

      {data && editingInterview ? (
        <InterviewDialog
          open={Boolean(editingInterview)}
          onOpenChange={(next) => {
            if (!next) {
              setEditingInterview(undefined)
            }
          }}
          applications={[data]}
          interview={editingInterview}
        />
      ) : null}
    </>
  )
}
