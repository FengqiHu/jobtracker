import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Calendar as BigCalendar,
  dateFnsLocalizer,
  type Event as CalendarEvent
} from "react-big-calendar"
import { format, getDay, parse, startOfWeek } from "date-fns"
import { enUS } from "date-fns/locale"
import { CalendarPlus, PencilLine, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { InterviewDialog } from "@/components/InterviewDialog"
import { StatusBadge } from "@/components/StatusBadge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { deleteInterview, getApplications, getCalendarConnectUrl, getEmailAccounts, syncCalendar } from "@/lib/api"
import { useInterviewsInRange } from "@/hooks/useInterviews"
import type { Application, InterviewRangeItem } from "@/lib/types"
import { formatDateTime } from "@/lib/utils"

const locales = {
  "en-US": enUS
}

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales
})

type InterviewEvent = CalendarEvent & {
  resource: InterviewRangeItem
}

export default function CalendarPage() {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<InterviewRangeItem | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<InterviewRangeItem | null>(null)
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all")

  const [from, to] = useMemo(() => {
    const now = Date.now()
    return [
      new Date(now).toISOString(),
      new Date(now + 90 * 24 * 60 * 60 * 1000).toISOString()
    ]
  }, [])
  const interviewsQuery = useInterviewsInRange(from, to)
  const applicationsQuery = useQuery({
    queryKey: ["applications", "calendar-options"],
    queryFn: () => getApplications({ limit: 200, sortBy: "updatedAt", order: "desc" })
  })
  const accountsQuery = useQuery({
    queryKey: ["email-accounts"],
    queryFn: getEmailAccounts,
    staleTime: 60_000
  })

  const accounts = accountsQuery.data ?? []
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) ?? null

  const syncMutation = useMutation({
    mutationFn: (accountId: string) => syncCalendar(accountId),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["interviews"] })
      toast.success(`Calendar synced — ${result.created} new, ${result.synced} updated`)
    },
    onError: () => toast.error("Unable to sync Google Calendar")
  })

  const calendarConnectMutation = useMutation({
    mutationFn: (accountId: string) => getCalendarConnectUrl(accountId),
    onSuccess: ({ authUrl }) => { window.location.href = authUrl },
    onError: () => toast.error("Unable to start Google Calendar connection")
  })

  const deleteMutation = useMutation({
    mutationFn: deleteInterview,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["interviews"] }),
        queryClient.invalidateQueries({ queryKey: ["applications"] })
      ])
      toast.success("Interview deleted")
      setSelected(null)
    },
    onError: () => toast.error("Unable to delete interview")
  })

  const events = useMemo<InterviewEvent[]>(() => {
    const all = interviewsQuery.data ?? []
    const filtered = selectedAccountId === "all"
      ? all
      : all.filter((i) => i.application.emailAccountId === selectedAccountId)
    return filtered.map((interview) => ({
      title: `${interview.application.company} — ${interview.application.role}`,
      start: new Date(interview.scheduledAt),
      end: new Date(new Date(interview.scheduledAt).getTime() + interview.durationMinutes * 60_000),
      resource: interview
    }))
  }, [interviewsQuery.data, selectedAccountId])

  const eventStyleGetter = (event: InterviewEvent) => {
    const status = event.resource.application.status
    if (status === "INTERVIEWING") {
      return { style: { backgroundColor: "#3b82f6", borderRadius: "12px", border: 0 } }
    }
    if (status === "OFFER") {
      return { style: { backgroundColor: "#16a34a", borderRadius: "12px", border: 0 } }
    }
    return { style: { backgroundColor: "#9ca3af", borderRadius: "12px", border: 0 } }
  }

  const applications = applicationsQuery.data?.data ?? []

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-[24px] bg-white px-6 py-8 shadow-card md:flex-row md:items-end md:justify-between md:px-8">
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#8a8a8a]">
            Calendar
          </p>
          <h1 className="text-[36px] leading-[1.05] md:text-[56px]">See every interview in one calm timeline.</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All accounts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts</SelectItem>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedAccount && !selectedAccount.calendarConnected ? (
            <Button
              variant="secondary"
              onClick={() => calendarConnectMutation.mutate(selectedAccount.id)}
              disabled={calendarConnectMutation.isPending}
            >
              <CalendarPlus className="h-4 w-4" />
              Connect Calendar
            </Button>
          ) : null}

          {selectedAccount?.calendarConnected ? (
            <Button
              variant="secondary"
              onClick={() => syncMutation.mutate(selectedAccount.id)}
              disabled={syncMutation.isPending}
            >
              <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
              {syncMutation.isPending ? "Syncing..." : "Sync now"}
            </Button>
          ) : null}

          <Button onClick={() => setDialogOpen(true)}>Schedule Interview</Button>
        </div>
      </section>

      <Card className="p-4">
        <BigCalendar
          localizer={localizer}
          events={events}
          defaultView="month"
          views={["month", "week", "day"]}
          style={{ height: 760 }}
          eventPropGetter={eventStyleGetter}
          onSelectEvent={(event) => setSelected(event.resource)}
        />
      </Card>

      <InterviewDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        applications={applications as Application[]}
      />

      <InterviewDialog
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        applications={selected ? [selected.application] : []}
        interview={editing ?? undefined}
      />

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent>
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>{selected.title}</SheetTitle>
                <SheetDescription>
                  Review details and keep the linked application in context.
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-6">
                <div className="rounded-[16px] bg-[#fafafa] p-5">
                  <p className="font-display text-[24px] font-semibold text-[#242424]">
                    {selected.application.company}
                  </p>
                  <p className="text-sm text-[#898989]">{selected.application.role}</p>
                  <div className="mt-4">
                    <StatusBadge status={selected.application.status} />
                  </div>
                </div>

                <div className="space-y-3 text-sm text-[#242424]">
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#8a8a8a]">
                      Date & time
                    </p>
                    <p>{formatDateTime(selected.scheduledAt)}</p>
                  </div>
                  {selected.location ? (
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#8a8a8a]">
                        Location
                      </p>
                      <p>{selected.location}</p>
                    </div>
                  ) : null}
                  {selected.notes ? (
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#8a8a8a]">
                        Notes
                      </p>
                      <p className="text-[#898989]">{selected.notes}</p>
                    </div>
                  ) : null}
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setEditing(selected)
                    }}
                  >
                    <PencilLine className="h-4 w-4" />
                    Edit
                  </Button>
                  <Button variant="ghost" onClick={() => deleteMutation.mutate(selected.id)}>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
